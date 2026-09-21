package com.xisnd.monitoring.ingest;

import com.xisnd.monitoring.agent.Agent;
import com.xisnd.monitoring.agent.AgentRepository;
import com.xisnd.monitoring.agent.AgentTokens;
import com.xisnd.monitoring.common.ApiException;
import com.xisnd.monitoring.event.EventLevel;
import com.xisnd.monitoring.event.EventService;
import com.xisnd.monitoring.event.EventType;
import com.xisnd.monitoring.ingest.IngestDtos.HeartbeatRequest;
import com.xisnd.monitoring.ingest.IngestDtos.HeartbeatResponse;
import com.xisnd.monitoring.ingest.IngestDtos.IngestResult;
import com.xisnd.monitoring.ingest.IngestDtos.LogBatchRequest;
import com.xisnd.monitoring.ingest.IngestDtos.LogItem;
import com.xisnd.monitoring.ingest.IngestDtos.MetricBatchRequest;
import com.xisnd.monitoring.ingest.IngestDtos.MetricItem;
import com.xisnd.monitoring.project.Project;
import com.xisnd.monitoring.project.ProjectRepository;
import com.xisnd.monitoring.telemetry.LogEntry;
import com.xisnd.monitoring.telemetry.LogEntryRepository;
import com.xisnd.monitoring.telemetry.LogFingerprint;
import com.xisnd.monitoring.telemetry.LogLevel;
import com.xisnd.monitoring.telemetry.MetricPoint;
import com.xisnd.monitoring.telemetry.MetricPointRepository;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class IngestService {

    static final int MAX_LOGS = 1000;
    static final int MAX_METRICS = 500;

    private final AgentRepository agentRepository;
    private final ProjectRepository projectRepository;
    private final LogEntryRepository logRepository;
    private final MetricPointRepository metricRepository;
    private final EventService eventService;
    private final IngestRateLimiter rateLimiter;

    @Transactional
    public HeartbeatResponse heartbeat(String token, HeartbeatRequest request, String remoteIp) {
        Agent agent = authenticate(token);
        Project project = projectOf(agent);
        LocalDateTime now = LocalDateTime.now();
        String ip = request == null || request.ipAddress() == null || request.ipAddress().isBlank()
                ? remoteIp : request.ipAddress();
        boolean reconnected = request == null
                ? agent.touch(null, null, null, ip, now)
                : agent.touch(request.hostname(), request.os(), request.agentVersion(), ip, now);
        if (reconnected) {
            eventService.record(project, EventType.AGENT_CONNECTED, EventLevel.INFO,
                    "에이전트가 연결되었습니다", agent.getName() + hostSuffix(agent));
        }
        return new HeartbeatResponse(agent.getId(), agent.getName(), project.getId(), project.getName(),
                project.getProjectCode(), now);
    }

    @Transactional
    public IngestResult logs(String token, LogBatchRequest request) {
        Agent agent = authenticate(token);
        List<LogItem> items = request == null || request.entries() == null ? List.of() : request.entries();
        if (items.size() > MAX_LOGS) {
            throw ApiException.badRequest("한 번에 " + MAX_LOGS + "건까지 보낼 수 있습니다.");
        }
        LocalDateTime now = LocalDateTime.now();
        List<LogEntry> rows = new ArrayList<>(items.size());
        int rejected = 0;
        for (LogItem item : items) {
            if (item == null || item.message() == null || item.message().isBlank()) {
                rejected++;
                continue;
            }
            String message = cut(item.message().stripTrailing(), LogEntry.MAX_MESSAGE);
            rows.add(LogEntry.builder()
                    .projectId(agent.getProjectId())
                    .agentId(agent.getId())
                    .source(item.source() == null ? null : cut(item.source(), 255))
                    .level(LogLevel.parse(item.level()))
                    .message(message)
                    .fingerprint(LogFingerprint.of(message))
                    .loggedAt(toLocal(item.timestamp(), now))
                    .receivedAt(now)
                    .build());
        }
        logRepository.saveAll(rows);
        agent.touch(null, null, null, null, now);
        return new IngestResult(rows.size(), rejected);
    }

    @Transactional
    public IngestResult metrics(String token, MetricBatchRequest request) {
        Agent agent = authenticate(token);
        List<MetricItem> items = request == null || request.points() == null ? List.of() : request.points();
        if (items.size() > MAX_METRICS) {
            throw ApiException.badRequest("한 번에 " + MAX_METRICS + "건까지 보낼 수 있습니다.");
        }
        LocalDateTime now = LocalDateTime.now();
        List<MetricPoint> rows = new ArrayList<>(items.size());
        int rejected = 0;
        for (MetricItem item : items) {
            if (item == null) {
                rejected++;
                continue;
            }
            rows.add(MetricPoint.builder()
                    .projectId(agent.getProjectId())
                    .agentId(agent.getId())
                    .collectedAt(toLocal(item.timestamp(), now))
                    .cpuPct(percent(item.cpuPct()))
                    .memoryPct(percent(item.memoryPct()))
                    .memoryUsedMb(positive(item.memoryUsedMb()))
                    .memoryTotalMb(positive(item.memoryTotalMb()))
                    .diskPct(percent(item.diskPct()))
                    .diskUsedGb(positive(item.diskUsedGb()))
                    .diskTotalGb(positive(item.diskTotalGb()))
                    .netInKbps(positive(item.netInKbps()))
                    .netOutKbps(positive(item.netOutKbps()))
                    .build());
        }
        metricRepository.saveAll(rows);
        agent.touch(null, null, null, null, now);
        return new IngestResult(rows.size(), rejected);
    }

    private Agent authenticate(String token) {
        if (token == null || token.isBlank()) {
            throw ApiException.unauthorized("에이전트 토큰이 필요합니다.");
        }
        Agent agent = agentRepository.findByTokenHash(AgentTokens.hash(token))
                .orElseThrow(() -> ApiException.unauthorized("에이전트 토큰이 올바르지 않습니다."));
        if (!rateLimiter.tryAcquire(agent.getId())) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "요청이 너무 많습니다. 잠시 후 다시 보내주세요.");
        }
        return agent;
    }

    private Project projectOf(Agent agent) {
        return projectRepository.findById(agent.getProjectId())
                .orElseThrow(() -> ApiException.unauthorized("에이전트 토큰이 올바르지 않습니다."));
    }

    // 에이전트 시계가 틀어져 미래 시각이 오면 받은 시각으로 기록
    private static LocalDateTime toLocal(OffsetDateTime timestamp, LocalDateTime now) {
        if (timestamp == null) {
            return now;
        }
        LocalDateTime local = timestamp.atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        return local.isAfter(now.plusMinutes(5)) ? now : local;
    }

    private static Double percent(Double value) {
        if (value == null || value.isNaN()) {
            return null;
        }
        return Math.max(0, Math.min(100, value));
    }

    private static Double positive(Double value) {
        if (value == null || value.isNaN() || value < 0) {
            return null;
        }
        return value;
    }

    private static String cut(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }

    static String hostSuffix(Agent agent) {
        return agent.getHostname() == null ? "" : " (" + agent.getHostname() + ")";
    }
}
