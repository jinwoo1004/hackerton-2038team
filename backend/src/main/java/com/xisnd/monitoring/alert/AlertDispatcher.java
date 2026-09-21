package com.xisnd.monitoring.alert;

import com.xisnd.monitoring.agent.Agent;
import com.xisnd.monitoring.agent.AgentRepository;
import com.xisnd.monitoring.alert.SlackNotifier.AlertMessage;
import com.xisnd.monitoring.event.EventLevel;
import com.xisnd.monitoring.event.EventService;
import com.xisnd.monitoring.event.EventType;
import com.xisnd.monitoring.incident.Incident;
import com.xisnd.monitoring.incident.IncidentChanged;
import com.xisnd.monitoring.incident.IncidentRepository;
import com.xisnd.monitoring.incident.IncidentSeverity;
import com.xisnd.monitoring.project.Project;
import com.xisnd.monitoring.project.ProjectRepository;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Executor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

@Slf4j
@Component
public class AlertDispatcher {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final IncidentRepository incidentRepository;
    private final ProjectRepository projectRepository;
    private final AgentRepository agentRepository;
    private final AlertRuleRepository ruleRepository;
    private final AlertChannelRepository channelRepository;
    private final AlertDeliveryRepository deliveryRepository;
    private final SlackNotifier slack;
    private final EventService eventService;
    private final AlertProperties properties;
    private final ObjectProvider<IncidentInsight> insight;
    private final Executor executor;
    private final TransactionTemplate tx;

    public AlertDispatcher(IncidentRepository incidentRepository, ProjectRepository projectRepository,
                           AgentRepository agentRepository, AlertRuleRepository ruleRepository,
                           AlertChannelRepository channelRepository, AlertDeliveryRepository deliveryRepository,
                           SlackNotifier slack, EventService eventService, AlertProperties properties,
                           ObjectProvider<IncidentInsight> insight, @Qualifier("alertExecutor") Executor executor,
                           TransactionTemplate tx) {
        this.incidentRepository = incidentRepository;
        this.projectRepository = projectRepository;
        this.agentRepository = agentRepository;
        this.ruleRepository = ruleRepository;
        this.channelRepository = channelRepository;
        this.deliveryRepository = deliveryRepository;
        this.slack = slack;
        this.eventService = eventService;
        this.properties = properties;
        this.insight = insight;
        this.executor = executor;
        this.tx = tx;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void on(IncidentChanged event) {
        executor.execute(() -> {
            try {
                tx.executeWithoutResult(status -> dispatch(event));
            } catch (Exception e) {
                log.warn("알림 발송 처리 실패 incident={}: {}", event.incidentId(), e.getMessage());
            }
        });
    }

    void dispatch(IncidentChanged event) {
        Incident incident = incidentRepository.findById(event.incidentId()).orElse(null);
        if (incident == null) {
            return;
        }
        Project project = projectRepository.findById(incident.getProjectId()).orElse(null);
        if (project == null) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        DeliveryKind kind = DeliveryKind.valueOf(event.kind().name());

        Map<Long, AlertRule> byChannel = new LinkedHashMap<>();
        for (AlertRule rule : ruleRepository.findByUserIdAndEnabledTrue(project.getCreatedBy())) {
            if (!rule.matches(project.getId(), incident.getRule(), incident.getSeverity())) {
                continue;
            }
            if (kind == DeliveryKind.RESOLVED && !rule.isNotifyResolved()) {
                continue;
            }
            if (incident.getSeverity() != IncidentSeverity.CRITICAL && rule.isQuiet(now.toLocalTime())) {
                continue;
            }
            byChannel.putIfAbsent(rule.getChannelId(), rule);
        }
        if (byChannel.isEmpty()) {
            return;
        }

        String agentName = incident.getAgentId() == null ? null
                : agentRepository.findById(incident.getAgentId()).map(Agent::getName).orElse(null);
        AlertMessage message = message(incident, project, agentName, kind);

        byChannel.forEach((channelId, rule) -> {
            AlertChannel channel = channelRepository.findById(channelId).orElse(null);
            if (channel == null || !channel.isEnabled()) {
                return;
            }
            // 열렸다 닫혔다 반복하는 이상은 짧은 시간 안에 다시 보내지 않는다
            if (kind == DeliveryKind.OPENED && deliveryRepository.existsByChannelIdAndDedupKeyAndKindInAndSuccessTrueAndSentAtAfter(
                    channelId, incident.getDedupKey(), EnumSet.of(DeliveryKind.OPENED, DeliveryKind.ESCALATED),
                    now.minusMinutes(properties.dedupMinutes()))) {
                return;
            }
            Optional<String> error = slack.send(channel.getTarget(), message);
            channel.recordResult(now, error.orElse(null));
            deliveryRepository.save(AlertDelivery.builder()
                    .userId(project.getCreatedBy())
                    .channelId(channelId)
                    .channelName(channel.getName())
                    .ruleId(rule.getId())
                    .incidentId(incident.getId())
                    .projectId(project.getId())
                    .dedupKey(incident.getDedupKey())
                    .kind(kind)
                    .title(message.headline())
                    .success(error.isEmpty())
                    .error(error.orElse(null))
                    .sentAt(now)
                    .build());
            if (error.isEmpty()) {
                eventService.record(project, EventType.ALERT_SENT, EventLevel.INFO,
                        channel.getName() + " 채널로 알림을 보냈습니다", message.headline());
            } else {
                eventService.record(project, EventType.ALERT_FAILED, EventLevel.ERROR,
                        channel.getName() + " 채널 알림 발송에 실패했습니다", error.get());
            }
        });
    }

    AlertMessage message(Incident incident, Project project, String agentName, DeliveryKind kind) {
        String tag = switch (kind) {
            case RESOLVED -> "[해결]";
            case ESCALATED -> "[심각 격상]";
            default -> incident.getSeverity() == IncidentSeverity.CRITICAL ? "[심각]" : "[주의]";
        };
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("프로젝트", project.getName() + " (" + project.getProjectCode() + ")");
        fields.put("유형", incident.getRule().label());
        if (agentName != null) {
            fields.put("서버", agentName);
        }
        fields.put(kind == DeliveryKind.RESOLVED ? "해결 시각" : "발생 시각",
                (kind == DeliveryKind.RESOLVED && incident.getResolvedAt() != null
                        ? incident.getResolvedAt() : incident.getOpenedAt()).format(TIME));

        String detail = incident.getDetail();
        if (kind != DeliveryKind.RESOLVED) {
            Optional<String> summary = insight.stream().findFirst().flatMap(i -> i.summarize(incident));
            if (summary.isPresent()) {
                detail = detail == null ? summary.get() : detail + "\n\n" + summary.get();
            }
        }
        String link = properties.publicUrl() == null || properties.publicUrl().isBlank() ? null
                : properties.publicUrl().replaceAll("/+$", "") + "/projects/" + project.getId();
        return new AlertMessage(tag + " " + incident.getTitle(), fields, detail, "Monitoring Platform", link);
    }
}
