package com.xisnd.monitoring.alert;

import com.xisnd.monitoring.alert.AlertDtos.ChannelRequest;
import com.xisnd.monitoring.alert.AlertDtos.ChannelResponse;
import com.xisnd.monitoring.alert.AlertDtos.DeliveryResponse;
import com.xisnd.monitoring.alert.AlertDtos.RuleRequest;
import com.xisnd.monitoring.alert.AlertDtos.RuleResponse;
import com.xisnd.monitoring.alert.AlertDtos.TestResult;
import com.xisnd.monitoring.alert.SlackNotifier.AlertMessage;
import com.xisnd.monitoring.common.ApiException;
import com.xisnd.monitoring.project.Project;
import com.xisnd.monitoring.project.ProjectRepository;
import com.xisnd.monitoring.project.ProjectService;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AlertService {

    static final int MAX_CHANNELS = 10;
    static final int MAX_RULES = 30;

    private final AlertChannelRepository channelRepository;
    private final AlertRuleRepository ruleRepository;
    private final AlertDeliveryRepository deliveryRepository;
    private final ProjectRepository projectRepository;
    private final ProjectService projectService;
    private final SlackNotifier slack;

    @Transactional(readOnly = true)
    public List<ChannelResponse> channels(Long userId) {
        return channelRepository.findByUserIdOrderByCreatedAtAsc(userId).stream().map(ChannelResponse::from).toList();
    }

    @Transactional
    public ChannelResponse createChannel(Long userId, ChannelRequest request) {
        if (channelRepository.countByUserId(userId) >= MAX_CHANNELS) {
            throw ApiException.badRequest("알림 채널은 " + MAX_CHANNELS + "개까지 등록할 수 있습니다.");
        }
        slack.validate(request.webhookUrl());
        AlertChannel channel = channelRepository.save(AlertChannel.builder()
                .userId(userId)
                .type(request.type() == null ? AlertChannelType.SLACK : request.type())
                .name(request.name().trim())
                .target(request.webhookUrl().trim())
                .build());
        return ChannelResponse.from(channel);
    }

    @Transactional
    public ChannelResponse updateChannel(Long userId, Long channelId, ChannelRequest request) {
        AlertChannel channel = ownedChannel(userId, channelId);
        if (request.webhookUrl() != null && !request.webhookUrl().isBlank()) {
            slack.validate(request.webhookUrl());
        }
        channel.update(request.name(), request.webhookUrl(), request.enabled());
        return ChannelResponse.from(channel);
    }

    @Transactional
    public void deleteChannel(Long userId, Long channelId) {
        AlertChannel channel = ownedChannel(userId, channelId);
        ruleRepository.deleteByChannelId(channelId);
        channelRepository.delete(channel);
    }

    @Transactional
    public TestResult test(Long userId, Long channelId) {
        AlertChannel channel = ownedChannel(userId, channelId);
        LocalDateTime now = LocalDateTime.now();
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("채널", channel.getName());
        fields.put("보낸 시각", now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        Optional<String> error = slack.send(channel.getTarget(), new AlertMessage(
                "[테스트] 알림 채널이 연결되었습니다", fields, null, "Monitoring Platform", null));
        channel.recordResult(now, error.orElse(null));
        deliveryRepository.save(AlertDelivery.builder()
                .userId(userId)
                .channelId(channel.getId())
                .channelName(channel.getName())
                .kind(DeliveryKind.TEST)
                .title("테스트 발송")
                .success(error.isEmpty())
                .error(error.orElse(null))
                .sentAt(now)
                .build());
        return new TestResult(error.isEmpty(), error.orElse(null));
    }

    @Transactional(readOnly = true)
    public List<RuleResponse> rules(Long userId) {
        Map<Long, AlertChannel> channels = channelRepository.findByUserIdOrderByCreatedAtAsc(userId).stream()
                .collect(Collectors.toMap(AlertChannel::getId, Function.identity()));
        Map<Long, Project> projects = projectRepository.findByCreatedByOrderByCreatedAtDesc(userId).stream()
                .collect(Collectors.toMap(Project::getId, Function.identity()));
        return ruleRepository.findByUserIdOrderByCreatedAtAsc(userId).stream()
                .map(r -> toResponse(r, channels.get(r.getChannelId()), projects.get(r.getProjectId())))
                .toList();
    }

    @Transactional
    public RuleResponse createRule(Long userId, RuleRequest request) {
        if (ruleRepository.countByUserId(userId) >= MAX_RULES) {
            throw ApiException.badRequest("알림 규칙은 " + MAX_RULES + "개까지 만들 수 있습니다.");
        }
        AlertChannel channel = ownedChannel(userId, request.channelId());
        Project project = request.projectId() == null ? null : projectService.getOwnedProject(userId, request.projectId());
        validateQuiet(request);
        AlertRule rule = AlertRule.builder()
                .userId(userId)
                .name(request.name())
                .projectId(request.projectId())
                .channelId(channel.getId())
                .minSeverity(request.minSeverity())
                .rules(request.rules())
                .notifyResolved(request.notifyResolved())
                .quietStart(request.quietStart())
                .quietEnd(request.quietEnd())
                .build();
        if (request.enabled() != null) {
            rule.setEnabled(request.enabled());
        }
        return toResponse(ruleRepository.save(rule), channel, project);
    }

    @Transactional
    public RuleResponse updateRule(Long userId, Long ruleId, RuleRequest request) {
        AlertRule rule = ruleRepository.findByIdAndUserId(ruleId, userId)
                .orElseThrow(() -> ApiException.notFound("알림 규칙을 찾을 수 없습니다."));
        AlertChannel channel = ownedChannel(userId, request.channelId());
        Project project = request.projectId() == null ? null : projectService.getOwnedProject(userId, request.projectId());
        validateQuiet(request);
        rule.apply(request.name(), request.projectId(), channel.getId(), request.minSeverity(), request.rules(),
                request.notifyResolved(), request.quietStart(), request.quietEnd());
        if (request.enabled() != null) {
            rule.setEnabled(request.enabled());
        }
        return toResponse(rule, channel, project);
    }

    @Transactional
    public void deleteRule(Long userId, Long ruleId) {
        AlertRule rule = ruleRepository.findByIdAndUserId(ruleId, userId)
                .orElseThrow(() -> ApiException.notFound("알림 규칙을 찾을 수 없습니다."));
        ruleRepository.delete(rule);
    }

    @Transactional(readOnly = true)
    public List<DeliveryResponse> deliveries(Long userId, int limit) {
        int size = Math.min(Math.max(limit, 1), 200);
        return deliveryRepository.findByUserIdOrderBySentAtDescIdDesc(userId, PageRequest.of(0, size)).stream()
                .map(DeliveryResponse::from)
                .toList();
    }

    private AlertChannel ownedChannel(Long userId, Long channelId) {
        if (channelId == null) {
            throw ApiException.badRequest("알림을 받을 채널을 선택해주세요.");
        }
        return channelRepository.findByIdAndUserId(channelId, userId)
                .orElseThrow(() -> ApiException.notFound("알림 채널을 찾을 수 없습니다."));
    }

    private static void validateQuiet(RuleRequest request) {
        if ((request.quietStart() == null) != (request.quietEnd() == null)) {
            throw ApiException.badRequest("조용한 시간은 시작과 끝을 함께 입력해주세요.");
        }
    }

    private static RuleResponse toResponse(AlertRule r, AlertChannel channel, Project project) {
        return new RuleResponse(r.getId(), r.getName(), r.getProjectId(), project == null ? null : project.getName(),
                r.getChannelId(), channel == null ? null : channel.getName(), r.getMinSeverity(),
                List.copyOf(r.ruleSet()), r.isNotifyResolved(), r.getQuietStart(), r.getQuietEnd(), r.isEnabled(),
                r.getCreatedAt());
    }
}
