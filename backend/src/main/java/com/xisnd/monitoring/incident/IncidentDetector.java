package com.xisnd.monitoring.incident;

import com.xisnd.monitoring.agent.Agent;
import com.xisnd.monitoring.agent.AgentRepository;
import com.xisnd.monitoring.agent.AgentState;
import com.xisnd.monitoring.event.EventLevel;
import com.xisnd.monitoring.event.EventService;
import com.xisnd.monitoring.event.EventType;
import com.xisnd.monitoring.incident.AnomalyClient.Anomaly;
import com.xisnd.monitoring.incident.AnomalyClient.Series;
import com.xisnd.monitoring.incident.IncidentService.Signal;
import com.xisnd.monitoring.project.ProjectRepository;
import com.xisnd.monitoring.telemetry.LogEntry;
import com.xisnd.monitoring.telemetry.LogEntryRepository;
import com.xisnd.monitoring.telemetry.LogLevel;
import com.xisnd.monitoring.telemetry.MetricPoint;
import com.xisnd.monitoring.telemetry.MetricPointRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class IncidentDetector {

    private static final Set<LogLevel> ERRORS = EnumSet.of(LogLevel.ERROR, LogLevel.FATAL);
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm:ss");
    private static final int STAT_BUCKET_MINUTES = 5;
    private static final int STAT_WINDOWS = 24 * 60 / STAT_BUCKET_MINUTES;
    private static final int STAT_MIN_WINDOWS = 12;
    private static final int STAT_EVERY_RUNS = 5;
    private static final int NEW_ERRORS_PER_RUN = 3;

    private final DetectionProperties props;
    private final AgentRepository agentRepository;
    private final ProjectRepository projectRepository;
    private final MetricPointRepository metricRepository;
    private final LogEntryRepository logRepository;
    private final IncidentRepository incidentRepository;
    private final IncidentService incidentService;
    private final EventService eventService;
    private final AnomalyClient anomalyClient;

    private LocalDateTime lastRun;
    private long runs;

    @Scheduled(fixedDelayString = "${app.detection.interval-ms:60000}",
            initialDelayString = "${app.detection.initial-delay-ms:30000}")
    public void scheduled() {
        if (props.enabled()) {
            runOnce(LocalDateTime.now());
        }
    }

    public synchronized void runOnce(LocalDateTime now) {
        LocalDateTime since = lastRun == null ? now.minusMinutes(props.windowMinutes()) : lastRun;
        lastRun = now;
        boolean statistical = props.statistical() && runs++ % STAT_EVERY_RUNS == 0;

        Map<Long, List<Agent>> byProject = agentRepository.findAll().stream()
                .collect(Collectors.groupingBy(Agent::getProjectId, LinkedHashMap::new, Collectors.toList()));
        byProject.forEach((projectId, agents) -> {
            try {
                checkProject(projectId, agents, since, now, statistical);
            } catch (Exception e) {
                log.warn("이상 탐지 실패 project={}: {}", projectId, e.getMessage());
            }
        });
    }

    private void checkProject(Long projectId, List<Agent> agents, LocalDateTime since, LocalDateTime now,
                              boolean statistical) {
        for (Agent agent : agents) {
            checkAgent(agent, now);
        }
        checkErrorBurst(projectId, now);
        checkFatal(projectId, since, now);
        checkNewErrors(projectId, since, now);
        if (statistical) {
            checkTrends(projectId, agents, now);
        }
    }

    private void checkAgent(Agent agent, LocalDateTime now) {
        String downKey = IncidentService.key(IncidentRule.AGENT_DOWN, agent.getProjectId(), agent.getId(), null);
        AgentState state = agent.state(now);
        if (state == AgentState.PENDING) {
            return;
        }
        if (state == AgentState.OFFLINE) {
            if (agent.isConnected()) {
                agent.markDisconnected();
                agentRepository.save(agent);
                projectRepository.findById(agent.getProjectId()).ifPresent(p ->
                        eventService.record(p, EventType.AGENT_DISCONNECTED, EventLevel.WARNING,
                                "에이전트 연결이 끊겼습니다", agent.getName()));
            }
            long minutes = Duration.between(agent.getLastSeenAt(), now).toMinutes();
            incidentService.raise(new Signal(agent.getProjectId(), agent.getId(), IncidentRule.AGENT_DOWN,
                    IncidentSeverity.CRITICAL, downKey, agent.getName() + " 에이전트 연결이 끊겼습니다",
                    "마지막 수신 " + agent.getLastSeenAt().format(TIME) + ", " + minutes + "분째 응답이 없습니다.",
                    (double) minutes, (double) Agent.OFFLINE_AFTER_SECONDS / 60), now);
            return;
        }
        incidentService.clear(downKey, now);

        List<MetricPoint> points = metricRepository.findByAgentIdAndCollectedAtAfterOrderByCollectedAtAsc(
                agent.getId(), now.minusMinutes(props.windowMinutes()));
        if (points.size() >= 2) {
            threshold(agent, IncidentRule.CPU_HIGH, "CPU", average(points, MetricPoint::getCpuPct),
                    props.cpuWarn(), props.cpuCritical(), props.cpuWarn() - 10, now);
            threshold(agent, IncidentRule.MEMORY_HIGH, "메모리", average(points, MetricPoint::getMemoryPct),
                    props.memoryWarn(), props.memoryCritical(), props.memoryWarn() - 10, now);
        }
        if (!points.isEmpty()) {
            threshold(agent, IncidentRule.DISK_HIGH, "디스크", points.get(points.size() - 1).getDiskPct(),
                    props.diskWarn(), props.diskCritical(), props.diskWarn() - 5, now);
        }
    }

    private void threshold(Agent agent, IncidentRule rule, String what, Double value, double warn, double critical,
                           double clearBelow, LocalDateTime now) {
        if (value == null) {
            return;
        }
        String key = IncidentService.key(rule, agent.getProjectId(), agent.getId(), null);
        if (value >= warn) {
            IncidentSeverity severity = value >= critical ? IncidentSeverity.CRITICAL : IncidentSeverity.WARNING;
            String basis = rule == IncidentRule.DISK_HIGH ? "현재 " : "최근 " + props.windowMinutes() + "분 평균 ";
            incidentService.raise(new Signal(agent.getProjectId(), agent.getId(), rule, severity, key,
                    agent.getName() + " " + what + " 사용률 " + pct(value),
                    basis + pct(value) + ", 기준 " + pct(warn), value, warn), now);
        } else if (value < clearBelow) {
            incidentService.clear(key, now);
        }
    }

    private void checkErrorBurst(Long projectId, LocalDateTime now) {
        String key = IncidentService.key(IncidentRule.ERROR_BURST, projectId, null, null);
        long count = logRepository.countByProjectIdAndLevelInAndLoggedAtAfter(
                projectId, ERRORS, now.minusMinutes(props.windowMinutes()));
        if (count >= props.errorBurst()) {
            IncidentSeverity severity = count >= props.errorBurstCritical()
                    ? IncidentSeverity.CRITICAL : IncidentSeverity.WARNING;
            incidentService.raise(new Signal(projectId, null, IncidentRule.ERROR_BURST, severity, key,
                    "최근 " + props.windowMinutes() + "분 오류 로그 " + count + "건",
                    "기준 " + props.errorBurst() + "건 이상", (double) count, (double) props.errorBurst()), now);
        } else if (count < props.errorBurst() / 2.0) {
            incidentService.clear(key, now);
        }
    }

    private void checkFatal(Long projectId, LocalDateTime since, LocalDateTime now) {
        String key = IncidentService.key(IncidentRule.FATAL_LOG, projectId, null, null);
        List<LogEntry> fatal = logRepository.receivedSince(projectId, EnumSet.of(LogLevel.FATAL), since, PageRequest.of(0, 1));
        if (!fatal.isEmpty()) {
            LogEntry latest = fatal.get(0);
            incidentService.raise(new Signal(projectId, latest.getAgentId(), IncidentRule.FATAL_LOG,
                    IncidentSeverity.CRITICAL, key, "치명 로그가 발생했습니다", preview(latest), null, null), now);
            return;
        }
        clearIdle(projectId, IncidentRule.FATAL_LOG, props.fatalQuietMinutes(), now);
    }

    private void checkNewErrors(Long projectId, LocalDateTime since, LocalDateTime now) {
        clearIdle(projectId, IncidentRule.NEW_ERROR, props.newErrorHoldMinutes(), now);
        // 수집 초기에는 모든 오류가 처음 보는 것이라 한 시간은 지켜본다
        boolean hasHistory = logRepository.findFirstByProjectIdOrderByLoggedAtAsc(projectId)
                .map(e -> e.getLoggedAt().isBefore(now.minusHours(1)))
                .orElse(false);
        if (!hasHistory) {
            return;
        }
        Map<String, List<LogEntry>> byFingerprint = logRepository.receivedSince(projectId, ERRORS, since, PageRequest.of(0, 200))
                .stream()
                .filter(e -> e.getFingerprint() != null)
                .collect(Collectors.groupingBy(LogEntry::getFingerprint, LinkedHashMap::new, Collectors.toList()));
        int raised = 0;
        for (Map.Entry<String, List<LogEntry>> entry : byFingerprint.entrySet()) {
            if (raised >= NEW_ERRORS_PER_RUN) {
                break;
            }
            LocalDateTime first = entry.getValue().stream().map(LogEntry::getLoggedAt).min(LocalDateTime::compareTo).orElse(now);
            if (logRepository.existsByProjectIdAndFingerprintAndLoggedAtBefore(projectId, entry.getKey(), first)) {
                continue;
            }
            LogEntry sample = entry.getValue().get(0);
            incidentService.raise(new Signal(projectId, sample.getAgentId(), IncidentRule.NEW_ERROR,
                    IncidentSeverity.WARNING, IncidentService.key(IncidentRule.NEW_ERROR, projectId, null, entry.getKey()),
                    "처음 보는 오류가 나타났습니다", preview(sample), (double) entry.getValue().size(), null), now);
            raised++;
        }
    }

    private void checkTrends(Long projectId, List<Agent> agents, LocalDateTime now) {
        LocalDateTime end = floor(now);
        LocalDateTime start = end.minusMinutes((long) STAT_WINDOWS * STAT_BUCKET_MINUTES);
        boolean enoughHistory = logRepository.findFirstByProjectIdOrderByLoggedAtAsc(projectId)
                .map(e -> e.getLoggedAt().isBefore(end.minusMinutes((long) STAT_MIN_WINDOWS * STAT_BUCKET_MINUTES)))
                .orElse(false);

        List<Series> series = new ArrayList<>();
        if (enoughHistory) {
            List<LocalDateTime> times = logRepository.timesOf(projectId, ERRORS, start, PageRequest.of(0, 100_000));
            series.add(new Series("errors", countBuckets(times, start, end), 5));
        }
        Map<String, Agent> agentByKey = new LinkedHashMap<>();
        for (Agent agent : agents) {
            if (agent.state(now) != AgentState.ONLINE) {
                continue;
            }
            List<MetricPoint> points = metricRepository.findByAgentIdAndCollectedAtAfterOrderByCollectedAtAsc(agent.getId(), start);
            List<Double> cpu = averageBuckets(points, start, end);
            if (cpu.stream().filter(Objects::nonNull).count() >= STAT_MIN_WINDOWS) {
                String key = "cpu:" + agent.getId();
                agentByKey.put(key, agent);
                series.add(new Series(key, cpu, 20));
            }
        }
        if (series.isEmpty()) {
            return;
        }

        Map<String, Anomaly> anomalies = anomalyClient.detect(series).stream()
                .collect(Collectors.toMap(Anomaly::key, Function.identity(), (a, b) -> a));
        Set<String> checked = new HashSet<>();
        for (Series s : series) {
            checked.add(s.key());
            Agent agent = agentByKey.get(s.key());
            IncidentRule rule = agent == null ? IncidentRule.ERROR_SPIKE : IncidentRule.CPU_SPIKE;
            String key = IncidentService.key(rule, projectId, agent == null ? null : agent.getId(), null);
            Anomaly anomaly = anomalies.get(s.key());
            if (anomaly == null) {
                incidentService.clear(key, now);
                continue;
            }
            String title = agent == null
                    ? "오류 로그가 평소보다 많습니다"
                    : agent.getName() + " CPU 사용률이 평소보다 높습니다";
            String unit = agent == null ? "건" : "%";
            incidentService.raise(new Signal(projectId, agent == null ? null : agent.getId(), rule,
                    IncidentSeverity.WARNING, key, title,
                    "최근 " + STAT_BUCKET_MINUTES + "분 " + round(anomaly.value()) + unit + ", 평소 " + round(anomaly.baseline()) + unit,
                    anomaly.value(), anomaly.baseline()), now);
        }
    }

    private void clearIdle(Long projectId, IncidentRule rule, int idleMinutes, LocalDateTime now) {
        incidentRepository.findByProjectIdAndStatus(projectId, IncidentStatus.OPEN).stream()
                .filter(i -> i.getRule() == rule)
                .filter(i -> i.getLastDetectedAt().isBefore(now.minusMinutes(idleMinutes)))
                .forEach(i -> incidentService.resolve(i, now, "AUTO"));
    }

    static List<Double> countBuckets(List<LocalDateTime> times, LocalDateTime start, LocalDateTime end) {
        double[] counts = new double[STAT_WINDOWS];
        for (LocalDateTime t : times) {
            if (t.isBefore(start) || !t.isBefore(end)) {
                continue;
            }
            int index = (int) (Duration.between(start, t).toMinutes() / STAT_BUCKET_MINUTES);
            if (index >= 0 && index < STAT_WINDOWS) {
                counts[index]++;
            }
        }
        List<Double> result = new ArrayList<>(STAT_WINDOWS);
        for (double c : counts) {
            result.add(c);
        }
        return result;
    }

    static List<Double> averageBuckets(List<MetricPoint> points, LocalDateTime start, LocalDateTime end) {
        double[] sums = new double[STAT_WINDOWS];
        int[] counts = new int[STAT_WINDOWS];
        for (MetricPoint p : points) {
            if (p.getCpuPct() == null || p.getCollectedAt().isBefore(start) || !p.getCollectedAt().isBefore(end)) {
                continue;
            }
            int index = (int) (Duration.between(start, p.getCollectedAt()).toMinutes() / STAT_BUCKET_MINUTES);
            if (index >= 0 && index < STAT_WINDOWS) {
                sums[index] += p.getCpuPct();
                counts[index]++;
            }
        }
        List<Double> result = new ArrayList<>(STAT_WINDOWS);
        for (int i = 0; i < STAT_WINDOWS; i++) {
            result.add(counts[i] == 0 ? null : sums[i] / counts[i]);
        }
        return result;
    }

    private static LocalDateTime floor(LocalDateTime now) {
        LocalDateTime minute = now.withSecond(0).withNano(0);
        return minute.minusMinutes(minute.getMinute() % STAT_BUCKET_MINUTES);
    }

    private static Double average(List<MetricPoint> points, Function<MetricPoint, Double> getter) {
        var stats = points.stream().map(getter).filter(Objects::nonNull).mapToDouble(Double::doubleValue).summaryStatistics();
        return stats.getCount() == 0 ? null : stats.getAverage();
    }

    private static String preview(LogEntry entry) {
        String line = entry.getMessage().lines().findFirst().orElse("");
        return line.length() > 300 ? line.substring(0, 300) + "..." : line;
    }

    private static String pct(double value) {
        return round(value) + "%";
    }

    private static String round(double value) {
        double r = Math.round(value * 10) / 10.0;
        return r == Math.floor(r) ? String.valueOf((long) r) : String.valueOf(r);
    }
}
