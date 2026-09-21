package com.xisnd.monitoring.telemetry;

import com.xisnd.monitoring.agent.AgentDtos.AgentResponse;
import java.time.LocalDateTime;
import java.util.List;

public final class TelemetryDtos {

    private TelemetryDtos() {
    }

    public record LogEntryResponse(Long id, Long agentId, String agentName, String source, LogLevel level,
                                   String message, LocalDateTime loggedAt) {
    }

    public record MetricBucket(LocalDateTime time, Double cpuPct, Double memoryPct, Double diskPct,
                               Double netInKbps, Double netOutKbps) {
    }

    public record MetricSeries(Long agentId, String agentName, List<MetricBucket> points) {
    }

    public record MetricSeriesResponse(int minutes, int bucketSeconds, List<MetricSeries> series) {
    }

    public record LevelCount(long error, long warn, long total) {
    }

    public record ProjectMonitoring(Long projectId, String name, String projectCode, List<AgentResponse> agents,
                                    LevelCount logs1h, long openIncidents) {
    }

    public record MonitoringOverview(long agentsTotal, long agentsOnline, long errors1h, long openIncidents,
                                     List<ProjectMonitoring> projects, LocalDateTime checkedAt) {
    }
}
