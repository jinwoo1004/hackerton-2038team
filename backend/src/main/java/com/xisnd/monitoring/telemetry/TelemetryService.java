package com.xisnd.monitoring.telemetry;

import com.xisnd.monitoring.agent.Agent;
import com.xisnd.monitoring.agent.AgentDtos.AgentResponse;
import com.xisnd.monitoring.agent.AgentRepository;
import com.xisnd.monitoring.agent.AgentService;
import com.xisnd.monitoring.agent.AgentState;
import com.xisnd.monitoring.incident.IncidentRepository;
import com.xisnd.monitoring.incident.IncidentStatus;
import com.xisnd.monitoring.project.Project;
import com.xisnd.monitoring.project.ProjectRepository;
import com.xisnd.monitoring.project.ProjectService;
import com.xisnd.monitoring.telemetry.TelemetryDtos.LevelCount;
import com.xisnd.monitoring.telemetry.TelemetryDtos.LogEntryResponse;
import com.xisnd.monitoring.telemetry.TelemetryDtos.MetricBucket;
import com.xisnd.monitoring.telemetry.TelemetryDtos.MetricSeries;
import com.xisnd.monitoring.telemetry.TelemetryDtos.MetricSeriesResponse;
import com.xisnd.monitoring.telemetry.TelemetryDtos.MonitoringOverview;
import com.xisnd.monitoring.telemetry.TelemetryDtos.ProjectMonitoring;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TelemetryService {

    private static final Set<LogLevel> ERRORS = EnumSet.of(LogLevel.ERROR, LogLevel.FATAL);

    private final ProjectService projectService;
    private final ProjectRepository projectRepository;
    private final AgentRepository agentRepository;
    private final AgentService agentService;
    private final LogEntryRepository logRepository;
    private final MetricPointRepository metricRepository;
    private final IncidentRepository incidentRepository;
    private final com.xisnd.monitoring.incident.IncidentMetrics incidentMetrics;

    @Transactional(readOnly = true)
    public List<LogEntryResponse> logs(Long userId, Long projectId, Long agentId, String minLevel, String query,
                                       Long afterId, int limit) {
        projectService.getOwnedProject(userId, projectId);
        Map<Long, String> names = agentNames(projectId);
        String like = query == null || query.isBlank() ? null : "%" + query.trim().toLowerCase() + "%";
        int size = Math.min(Math.max(limit, 1), 500);
        return logRepository.search(projectId, agentId, levelsFrom(minLevel), like, afterId, PageRequest.of(0, size))
                .stream()
                .map(e -> new LogEntryResponse(e.getId(), e.getAgentId(), names.get(e.getAgentId()), e.getSource(),
                        e.getLevel(), e.getMessage(), e.getLoggedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public MetricSeriesResponse metrics(Long userId, Long projectId, Long agentId, int minutes) {
        projectService.getOwnedProject(userId, projectId);
        int range = Math.min(Math.max(minutes, 5), 60 * 24 * 7);
        int bucket = bucketSeconds(range);
        LocalDateTime from = LocalDateTime.now().minusMinutes(range);
        Map<Long, String> names = agentNames(projectId);

        List<MetricPoint> points = agentId == null
                ? metricRepository.findByProjectIdAndCollectedAtAfterOrderByCollectedAtAsc(projectId, from)
                : metricRepository.findByAgentIdAndCollectedAtAfterOrderByCollectedAtAsc(agentId, from).stream()
                        .filter(p -> p.getProjectId().equals(projectId))
                        .toList();

        Map<Long, List<MetricPoint>> byAgent = points.stream()
                .collect(Collectors.groupingBy(MetricPoint::getAgentId, LinkedHashMap::new, Collectors.toList()));
        List<MetricSeries> series = new ArrayList<>();
        byAgent.forEach((id, list) -> series.add(new MetricSeries(id, names.getOrDefault(id, "삭제된 에이전트"),
                bucketize(list, bucket))));
        return new MetricSeriesResponse(range, bucket, series);
    }

    @Transactional(readOnly = true)
    public MonitoringOverview overview(Long userId) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime hourAgo = now.minusHours(1);
        List<Project> projects = projectRepository.findByCreatedByOrderByCreatedAtDesc(userId);
        Map<Long, List<Agent>> agentsByProject = projects.isEmpty() ? Map.of()
                : agentRepository.findByProjectIdInOrderByCreatedAtAsc(projects.stream().map(Project::getId).toList())
                        .stream().collect(Collectors.groupingBy(Agent::getProjectId));

        long total = 0;
        long online = 0;
        long errors = 0;
        long incidents = 0;
        List<ProjectMonitoring> rows = new ArrayList<>();
        for (Project p : projects) {
            List<AgentResponse> agents = agentsByProject.getOrDefault(p.getId(), List.of()).stream()
                    .map(a -> agentService.toResponse(a, now))
                    .toList();
            LevelCount counts = levelCount(p.getId(), hourAgo);
            long open = incidentRepository.countByProjectIdAndStatus(p.getId(), IncidentStatus.OPEN);
            total += agents.size();
            online += agents.stream().filter(a -> a.state() == AgentState.ONLINE).count();
            errors += counts.error();
            incidents += open;
            rows.add(new ProjectMonitoring(p.getId(), p.getName(), p.getProjectCode(), agents, counts, open));
        }
        return new MonitoringOverview(total, online, errors, incidents, rows, now, incidentMetrics.health(projects), incidentMetrics.trend(projects));
    }

    public LevelCount levelCount(Long projectId, LocalDateTime from) {
        long error = 0;
        long warn = 0;
        long all = 0;
        for (Object[] row : logRepository.countByLevel(projectId, from)) {
            LogLevel level = (LogLevel) row[0];
            long count = ((Number) row[1]).longValue();
            all += count;
            if (ERRORS.contains(level)) {
                error += count;
            } else if (level == LogLevel.WARN) {
                warn += count;
            }
        }
        return new LevelCount(error, warn, all);
    }

    private Map<Long, String> agentNames(Long projectId) {
        return agentRepository.findByProjectIdOrderByCreatedAtAsc(projectId).stream()
                .collect(Collectors.toMap(Agent::getId, Agent::getName));
    }

    static Set<LogLevel> levelsFrom(String minLevel) {
        if (minLevel == null || minLevel.isBlank() || "ALL".equalsIgnoreCase(minLevel)) {
            return EnumSet.allOf(LogLevel.class);
        }
        LogLevel min = LogLevel.parse(minLevel);
        if (min == LogLevel.UNKNOWN) {
            return EnumSet.allOf(LogLevel.class);
        }
        EnumSet<LogLevel> set = EnumSet.noneOf(LogLevel.class);
        for (LogLevel level : LogLevel.values()) {
            if (level != LogLevel.UNKNOWN && level.ordinal() >= min.ordinal()) {
                set.add(level);
            }
        }
        return set;
    }

    static int bucketSeconds(int minutes) {
        if (minutes <= 60) {
            return 60;
        }
        if (minutes <= 360) {
            return 300;
        }
        if (minutes <= 1440) {
            return 900;
        }
        return 3600;
    }

    private static List<MetricBucket> bucketize(List<MetricPoint> points, int bucketSeconds) {
        ZoneId zone = ZoneId.systemDefault();
        TreeMap<Long, List<MetricPoint>> buckets = points.stream().collect(Collectors.groupingBy(
                p -> p.getCollectedAt().atZone(zone).toEpochSecond() / bucketSeconds, TreeMap::new, Collectors.toList()));
        List<MetricBucket> result = new ArrayList<>(buckets.size());
        buckets.forEach((key, list) -> result.add(new MetricBucket(
                LocalDateTime.ofInstant(Instant.ofEpochSecond(key * bucketSeconds), zone),
                avg(list, MetricPoint::getCpuPct),
                avg(list, MetricPoint::getMemoryPct),
                avg(list, MetricPoint::getDiskPct),
                avg(list, MetricPoint::getNetInKbps),
                avg(list, MetricPoint::getNetOutKbps))));
        return result;
    }

    private static Double avg(List<MetricPoint> list, Function<MetricPoint, Double> getter) {
        var stats = list.stream().map(getter).filter(v -> v != null).mapToDouble(Double::doubleValue).summaryStatistics();
        return stats.getCount() == 0 ? null : Math.round(stats.getAverage() * 10) / 10.0;
    }
}
