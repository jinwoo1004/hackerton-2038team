package com.xisnd.monitoring.agent;

import com.xisnd.monitoring.agent.AgentDtos.AgentCreatedResponse;
import com.xisnd.monitoring.agent.AgentDtos.AgentResponse;
import com.xisnd.monitoring.agent.AgentDtos.MetricSnapshot;
import com.xisnd.monitoring.common.ApiException;
import com.xisnd.monitoring.event.EventLevel;
import com.xisnd.monitoring.event.EventService;
import com.xisnd.monitoring.event.EventType;
import com.xisnd.monitoring.incident.IncidentService;
import com.xisnd.monitoring.project.Project;
import com.xisnd.monitoring.project.ProjectService;
import com.xisnd.monitoring.telemetry.LogEntryRepository;
import com.xisnd.monitoring.telemetry.MetricPointRepository;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AgentService {

    static final int MAX_PER_PROJECT = 20;

    private final AgentRepository agentRepository;
    private final ProjectService projectService;
    private final MetricPointRepository metricRepository;
    private final LogEntryRepository logRepository;
    private final EventService eventService;
    private final IncidentService incidentService;

    @Transactional(readOnly = true)
    public List<AgentResponse> list(Long userId, Long projectId) {
        projectService.getOwnedProject(userId, projectId);
        LocalDateTime now = LocalDateTime.now();
        return agentRepository.findByProjectIdOrderByCreatedAtAsc(projectId).stream()
                .map(a -> toResponse(a, now))
                .toList();
    }

    @Transactional
    public AgentCreatedResponse create(Long userId, Long projectId, String name) {
        Project project = projectService.getOwnedProject(userId, projectId);
        if (agentRepository.countByProjectId(projectId) >= MAX_PER_PROJECT) {
            throw ApiException.badRequest("프로젝트당 에이전트는 " + MAX_PER_PROJECT + "개까지 등록할 수 있습니다.");
        }
        String token = AgentTokens.generate();
        Agent agent = agentRepository.save(Agent.builder()
                .projectId(projectId)
                .name(name.trim())
                .tokenHash(AgentTokens.hash(token))
                .tokenPrefix(AgentTokens.displayPrefix(token))
                .build());
        eventService.record(project, EventType.AGENT_REGISTERED, EventLevel.INFO, "에이전트를 등록했습니다", agent.getName());
        return new AgentCreatedResponse(AgentResponse.of(agent, LocalDateTime.now(), null), token);
    }

    @Transactional
    public void delete(Long userId, Long projectId, Long agentId) {
        Project project = projectService.getOwnedProject(userId, projectId);
        Agent agent = agentRepository.findById(agentId)
                .filter(a -> a.getProjectId().equals(projectId))
                .orElseThrow(() -> ApiException.notFound("에이전트를 찾을 수 없습니다."));
        incidentService.resolveForAgent(agentId, LocalDateTime.now());
        logRepository.deleteByAgent(agentId);
        metricRepository.deleteByAgent(agentId);
        agentRepository.delete(agent);
        eventService.record(project, EventType.AGENT_DELETED, EventLevel.WARNING, "에이전트를 삭제했습니다", agent.getName());
    }

    public AgentResponse toResponse(Agent agent, LocalDateTime now) {
        MetricSnapshot latest = metricRepository.findFirstByAgentIdOrderByCollectedAtDesc(agent.getId())
                .map(MetricSnapshot::from)
                .orElse(null);
        return AgentResponse.of(agent, now, latest);
    }
}
