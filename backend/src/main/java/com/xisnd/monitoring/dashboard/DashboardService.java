package com.xisnd.monitoring.dashboard;

import com.xisnd.monitoring.agent.Agent;
import com.xisnd.monitoring.agent.AgentRepository;
import com.xisnd.monitoring.agent.AgentState;
import com.xisnd.monitoring.analysis.Analysis;
import com.xisnd.monitoring.analysis.AnalysisRepository;
import com.xisnd.monitoring.analysis.AnalysisServiceClient;
import com.xisnd.monitoring.analysis.AnalysisStatus;
import com.xisnd.monitoring.dashboard.DashboardDtos.AnalysisCounts;
import com.xisnd.monitoring.dashboard.DashboardDtos.AnalysisListItem;
import com.xisnd.monitoring.dashboard.DashboardDtos.DashboardResponse;
import com.xisnd.monitoring.dashboard.DashboardDtos.ProjectCounts;
import com.xisnd.monitoring.dashboard.DashboardDtos.ProjectHealth;
import com.xisnd.monitoring.dashboard.DashboardDtos.ServiceStatus;
import com.xisnd.monitoring.dashboard.DashboardDtos.SeverityCounts;
import com.xisnd.monitoring.dashboard.DashboardDtos.SystemStatus;
import com.xisnd.monitoring.event.EventService;
import com.xisnd.monitoring.file.ProjectFileRepository;
import com.xisnd.monitoring.project.Project;
import com.xisnd.monitoring.project.ProjectRepository;
import com.xisnd.monitoring.project.ProjectStatus;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final ProjectRepository projectRepository;
    private final ProjectFileRepository fileRepository;
    private final AnalysisRepository analysisRepository;
    private final EventService eventService;
    private final AnalysisServiceClient analysisClient;
    private final DataSource dataSource;
    private final AgentRepository agentRepository;
    private final com.xisnd.monitoring.incident.IncidentMetrics incidentMetrics;

    @Transactional(readOnly = true)
    public DashboardResponse dashboard(Long userId) {
        List<Project> projects = projectRepository.findByCreatedByOrderByCreatedAtDesc(userId);
        List<Long> ids = projects.stream().map(Project::getId).toList();

        ProjectCounts projectCounts = new ProjectCounts(
                projects.size(),
                countStatus(projects, ProjectStatus.READY),
                countStatus(projects, ProjectStatus.ANALYZING),
                countStatus(projects, ProjectStatus.ACTIVE),
                countStatus(projects, ProjectStatus.ERROR));

        long fileCount = projects.stream().mapToLong(p -> fileRepository.countByProjectId(p.getId())).sum();

        List<ProjectHealth> health = new ArrayList<>();
        long critical = 0;
        long warning = 0;
        long info = 0;
        List<Integer> scores = new ArrayList<>();
        for (Project p : projects) {
            Optional<Analysis> latest = analysisRepository.findFirstByProjectIdOrderByCreatedAtDesc(p.getId());
            Optional<Analysis> done = analysisRepository.findFirstByProjectIdAndStatusOrderByCreatedAtDesc(p.getId(), AnalysisStatus.COMPLETED);
            Analysis d = done.orElse(null);
            if (d != null && d.getScore() != null) {
                scores.add(d.getScore());
                critical += nz(d.getCriticalCount());
                warning += nz(d.getWarningCount());
                info += nz(d.getInfoCount());
            }
            health.add(new ProjectHealth(
                    p.getId(), p.getName(), p.getProjectCode(), p.getStatus(), p.getLastAnalyzedAt(),
                    latest.map(Analysis::getStatus).orElse(null),
                    d == null ? null : d.getScore(),
                    d == null ? null : d.getGrade(),
                    d == null ? null : d.getCriticalCount(),
                    d == null ? null : d.getWarningCount(),
                    d == null ? null : d.getInfoCount()));
        }

        AnalysisCounts analysisCounts = ids.isEmpty()
                ? new AnalysisCounts(0, 0, 0, 0, null)
                : new AnalysisCounts(
                        analysisRepository.countByProjectIdIn(ids),
                        analysisRepository.countByProjectIdInAndStatusIn(ids, List.of(AnalysisStatus.QUEUED, AnalysisStatus.ANALYZING)),
                        analysisRepository.countByProjectIdInAndStatusIn(ids, List.of(AnalysisStatus.COMPLETED)),
                        analysisRepository.countByProjectIdInAndStatusIn(ids, List.of(AnalysisStatus.FAILED)),
                        scores.isEmpty() ? null : (int) Math.round(scores.stream().mapToInt(Integer::intValue).average().orElse(0)));

        return new DashboardResponse(projectCounts, fileCount, analysisCounts,
                new SeverityCounts(critical, warning, info), health, eventService.recent(userId, 8),
                incidentMetrics.health(projects), incidentMetrics.trend(projects));
    }

    @Transactional(readOnly = true)
    public List<AnalysisListItem> analyses(Long userId, int limit) {
        List<Project> projects = projectRepository.findByCreatedByOrderByCreatedAtDesc(userId);
        if (projects.isEmpty()) {
            return List.of();
        }
        Map<Long, Project> byId = projects.stream().collect(Collectors.toMap(Project::getId, Function.identity()));
        int size = Math.min(Math.max(limit, 1), 300);
        return analysisRepository.findByProjectIdInOrderByCreatedAtDesc(byId.keySet(), PageRequest.of(0, size)).stream()
                .map(a -> {
                    Project p = byId.get(a.getProjectId());
                    return new AnalysisListItem(a.getId(), a.getProjectId(), p.getName(), p.getProjectCode(), a.getStatus(),
                            a.getStartedAt(), a.getCompletedAt(), a.getScore(), a.getGrade(), a.getCriticalCount(),
                            a.getWarningCount(), a.getInfoCount(),
                            a.getStatus() == AnalysisStatus.FAILED ? a.getSummary() : null);
                })
                .toList();
    }

    public SystemStatus systemStatus(Long userId) {
        List<ServiceStatus> services = new ArrayList<>();
        services.add(new ServiceStatus("api", "백엔드 API", "UP", "Spring Boot", 0L));
        services.add(databaseStatus());

        if (!analysisClient.isEnabled()) {
            services.add(new ServiceStatus("analysis", "분석 서비스", "DISABLED", "APP_ANALYSIS_ENABLED=false", null));
        } else {
            Optional<Long> latency = analysisClient.ping();
            services.add(new ServiceStatus("analysis", "분석 서비스", latency.isPresent() ? "UP" : "DOWN",
                    analysisClient.baseUrl(), latency.orElse(null)));
        }
        services.add(agentStatus(userId));
        return new SystemStatus(services, LocalDateTime.now());
    }

    private ServiceStatus agentStatus(Long userId) {
        List<Long> ids = projectRepository.findByCreatedByOrderByCreatedAtDesc(userId).stream().map(Project::getId).toList();
        List<Agent> agents = ids.isEmpty() ? List.of() : agentRepository.findByProjectIdInOrderByCreatedAtAsc(ids);
        if (agents.isEmpty()) {
            return new ServiceStatus("agent", "수집 에이전트", "NOT_CONNECTED", "등록된 에이전트가 없습니다", null);
        }
        LocalDateTime now = LocalDateTime.now();
        long online = agents.stream().filter(a -> a.state(now) == AgentState.ONLINE).count();
        String status = online == agents.size() ? "UP" : online == 0 ? "DOWN" : "DEGRADED";
        return new ServiceStatus("agent", "수집 에이전트", status, "온라인 " + online + " / 전체 " + agents.size(), null);
    }

    private ServiceStatus databaseStatus() {
        long started = System.currentTimeMillis();
        try (Connection connection = dataSource.getConnection()) {
            boolean valid = connection.isValid(2);
            return new ServiceStatus("db", "데이터베이스", valid ? "UP" : "DOWN",
                    connection.getMetaData().getDatabaseProductName(), System.currentTimeMillis() - started);
        } catch (Exception e) {
            return new ServiceStatus("db", "데이터베이스", "DOWN", "연결 실패", null);
        }
    }

    private static long countStatus(List<Project> projects, ProjectStatus status) {
        return projects.stream().filter(p -> p.getStatus() == status).count();
    }

    private static long nz(Integer value) {
        return value == null ? 0 : value;
    }
}
