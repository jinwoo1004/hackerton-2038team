package com.xisnd.monitoring.incident;

import com.xisnd.monitoring.agent.Agent;
import com.xisnd.monitoring.agent.AgentRepository;
import com.xisnd.monitoring.common.ApiException;
import com.xisnd.monitoring.event.EventLevel;
import com.xisnd.monitoring.event.EventService;
import com.xisnd.monitoring.event.EventType;
import com.xisnd.monitoring.incident.IncidentDtos.IncidentResponse;
import com.xisnd.monitoring.project.Project;
import com.xisnd.monitoring.project.ProjectRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentRepository repository;
    private final ProjectRepository projectRepository;
    private final AgentRepository agentRepository;
    private final EventService eventService;
    private final ApplicationEventPublisher publisher;

    @Transactional
    public Incident raise(Signal signal, LocalDateTime now) {
        Optional<Incident> existing = repository.findFirstByDedupKeyAndStatus(signal.dedupKey(), IncidentStatus.OPEN);
        if (existing.isPresent()) {
            Incident incident = existing.get();
            if (incident.refresh(signal.severity(), signal.title(), signal.detail(), signal.observed(), now)) {
                publisher.publishEvent(new IncidentChanged(incident.getId(), IncidentChanged.Kind.ESCALATED));
            }
            return incident;
        }
        Project project = projectRepository.findById(signal.projectId()).orElse(null);
        if (project == null) {
            return null;
        }
        Incident incident = repository.save(Incident.builder()
                .projectId(signal.projectId())
                .agentId(signal.agentId())
                .rule(signal.rule())
                .severity(signal.severity())
                .dedupKey(signal.dedupKey())
                .title(signal.title())
                .detail(signal.detail())
                .observed(signal.observed())
                .threshold(signal.threshold())
                .openedAt(now)
                .build());
        eventService.record(project, EventType.INCIDENT_OPENED,
                signal.severity() == IncidentSeverity.CRITICAL ? EventLevel.ERROR : EventLevel.WARNING,
                incident.getTitle(), incident.getDetail());
        publisher.publishEvent(new IncidentChanged(incident.getId(), IncidentChanged.Kind.OPENED));
        return incident;
    }

    @Transactional
    public void clear(String dedupKey, LocalDateTime now) {
        repository.findFirstByDedupKeyAndStatus(dedupKey, IncidentStatus.OPEN)
                .ifPresent(i -> resolve(i, now, "AUTO"));
    }

    @Transactional
    public void resolve(Incident incident, LocalDateTime now, String by) {
        if (!incident.isOpen()) {
            return;
        }
        incident.resolve(now, by);
        projectRepository.findById(incident.getProjectId()).ifPresent(project ->
                eventService.record(project, EventType.INCIDENT_RESOLVED, EventLevel.INFO,
                        incident.getRule().label() + " 해결", incident.getTitle()));
        publisher.publishEvent(new IncidentChanged(incident.getId(), IncidentChanged.Kind.RESOLVED));
    }

    @Transactional
    public void resolveForAgent(Long agentId, LocalDateTime now) {
        repository.findByAgentIdAndStatus(agentId, IncidentStatus.OPEN).forEach(i -> resolve(i, now, "AUTO"));
    }

    @Transactional(readOnly = true)
    public List<IncidentResponse> search(Long userId, Long projectId, IncidentStatus status, int limit) {
        Map<Long, Project> projects = projectRepository.findByCreatedByOrderByCreatedAtDesc(userId).stream()
                .filter(p -> projectId == null || p.getId().equals(projectId))
                .collect(Collectors.toMap(Project::getId, Function.identity()));
        if (projects.isEmpty()) {
            return List.of();
        }
        Map<Long, String> agentNames = agentRepository.findByProjectIdInOrderByCreatedAtAsc(projects.keySet()).stream()
                .collect(Collectors.toMap(Agent::getId, Agent::getName));
        int size = Math.min(Math.max(limit, 1), 200);
        return repository.search(projects.keySet(), status, PageRequest.of(0, size)).stream()
                .map(i -> IncidentResponse.of(i, projects.get(i.getProjectId()), agentNames.get(i.getAgentId())))
                .toList();
    }

    @Transactional
    public IncidentResponse resolveManually(Long userId, Long incidentId) {
        Incident incident = repository.findById(incidentId)
                .orElseThrow(() -> ApiException.notFound("이상 기록을 찾을 수 없습니다."));
        Project project = projectRepository.findById(incident.getProjectId())
                .filter(p -> p.getCreatedBy().equals(userId))
                .orElseThrow(() -> ApiException.notFound("이상 기록을 찾을 수 없습니다."));
        resolve(incident, LocalDateTime.now(), "USER");
        String agentName = incident.getAgentId() == null ? null
                : agentRepository.findById(incident.getAgentId()).map(Agent::getName).orElse(null);
        return IncidentResponse.of(incident, project, agentName);
    }

    public record Signal(Long projectId, Long agentId, IncidentRule rule, IncidentSeverity severity, String dedupKey,
                         String title, String detail, Double observed, Double threshold) {
    }

    public static String key(IncidentRule rule, Long projectId, Long agentId, String extra) {
        return rule.name() + ":" + projectId + ":" + (agentId == null ? "-" : agentId) + (extra == null ? "" : ":" + extra);
    }
}
