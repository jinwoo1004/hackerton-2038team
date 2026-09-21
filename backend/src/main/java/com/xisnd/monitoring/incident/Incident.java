package com.xisnd.monitoring.incident;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Getter
@Entity
@Table(name = "incident", indexes = {
        @Index(name = "idx_incident_project_status", columnList = "projectId, status"),
        @Index(name = "idx_incident_dedup", columnList = "dedupKey, status")
})
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Incident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long projectId;

    private Long agentId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private IncidentRule rule;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 10)
    private IncidentSeverity severity;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 10)
    private IncidentStatus status;

    @Column(nullable = false, length = 160)
    private String dedupKey;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 1000)
    private String detail;
    @jakarta.persistence.Lob
    @Column(name = "insight_json")
    private String insightJson;

    public void attachInsight(String json) { this.insightJson = json; }

    private Double observed;

    private Double threshold;

    @Column(nullable = false)
    private LocalDateTime openedAt;

    @Column(nullable = false)
    private LocalDateTime lastDetectedAt;

    private LocalDateTime resolvedAt;

    @Column(length = 20)
    private String resolvedBy;

    @Builder
    public Incident(Long projectId, Long agentId, IncidentRule rule, IncidentSeverity severity, String dedupKey,
                    String title, String detail, Double observed, Double threshold, LocalDateTime openedAt) {
        this.projectId = projectId;
        this.agentId = agentId;
        this.rule = rule;
        this.severity = severity;
        this.status = IncidentStatus.OPEN;
        this.dedupKey = dedupKey;
        this.title = cut(title, 200);
        this.detail = detail == null ? null : cut(detail, 1000);
        this.observed = observed;
        this.threshold = threshold;
        this.openedAt = openedAt;
        this.lastDetectedAt = openedAt;
    }

    public boolean refresh(IncidentSeverity severity, String title, String detail, Double observed, LocalDateTime now) {
        boolean escalated = this.severity == IncidentSeverity.WARNING && severity == IncidentSeverity.CRITICAL;
        if (escalated) {
            this.severity = severity;
            this.title = cut(title, 200);
        }
        if (detail != null) {
            this.detail = cut(detail, 1000);
        }
        this.observed = observed;
        this.lastDetectedAt = now;
        return escalated;
    }

    public void resolve(LocalDateTime now, String by) {
        this.status = IncidentStatus.RESOLVED;
        this.resolvedAt = now;
        this.resolvedBy = by;
    }

    public boolean isOpen() {
        return status == IncidentStatus.OPEN;
    }

    private static String cut(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }
}
