package com.xisnd.monitoring.ingest;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;

public final class IngestDtos {

    private IngestDtos() {
    }

    public record HeartbeatRequest(String hostname, String os, String agentVersion, String ipAddress) {
    }

    public record HeartbeatResponse(Long agentId, String agentName, Long projectId, String projectName,
                                    String projectCode, LocalDateTime serverTime) {
    }

    public record LogItem(OffsetDateTime timestamp, String level, String source, String message) {
    }

    public record LogBatchRequest(List<LogItem> entries) {
    }

    public record MetricItem(OffsetDateTime timestamp, Double cpuPct, Double memoryPct, Double memoryUsedMb,
                             Double memoryTotalMb, Double diskPct, Double diskUsedGb, Double diskTotalGb,
                             Double netInKbps, Double netOutKbps) {
    }

    public record MetricBatchRequest(List<MetricItem> points) {
    }

    public record IngestResult(int accepted, int rejected) {
    }
}
