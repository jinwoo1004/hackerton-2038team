package com.xisnd.monitoring.telemetry;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "metric_point", indexes = {
        @Index(name = "idx_metric_agent_time", columnList = "agentId, collectedAt"),
        @Index(name = "idx_metric_project_time", columnList = "projectId, collectedAt")
})
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MetricPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long projectId;

    @Column(nullable = false)
    private Long agentId;

    @Column(nullable = false)
    private LocalDateTime collectedAt;

    private Double cpuPct;

    private Double memoryPct;

    private Double memoryUsedMb;

    private Double memoryTotalMb;

    private Double diskPct;

    private Double diskUsedGb;

    private Double diskTotalGb;

    private Double netInKbps;

    private Double netOutKbps;

    @Builder
    public MetricPoint(Long projectId, Long agentId, LocalDateTime collectedAt, Double cpuPct, Double memoryPct,
                       Double memoryUsedMb, Double memoryTotalMb, Double diskPct, Double diskUsedGb,
                       Double diskTotalGb, Double netInKbps, Double netOutKbps) {
        this.projectId = projectId;
        this.agentId = agentId;
        this.collectedAt = collectedAt;
        this.cpuPct = cpuPct;
        this.memoryPct = memoryPct;
        this.memoryUsedMb = memoryUsedMb;
        this.memoryTotalMb = memoryTotalMb;
        this.diskPct = diskPct;
        this.diskUsedGb = diskUsedGb;
        this.diskTotalGb = diskTotalGb;
        this.netInKbps = netInKbps;
        this.netOutKbps = netOutKbps;
    }
}
