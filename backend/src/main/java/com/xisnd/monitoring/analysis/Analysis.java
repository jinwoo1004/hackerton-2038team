package com.xisnd.monitoring.analysis;

import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Getter
@Entity
@Table(name = "analysis")
@EntityListeners(AuditingEntityListener.class)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Analysis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long projectId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private AnalysisStatus status;

    @Column(length = 80)
    private String externalId;

    private LocalDateTime startedAt;

    private LocalDateTime completedAt;

    @Column(length = 4000)
    private String summary;

    private Integer score;

    @Column(length = 2)
    private String grade;

    private Integer criticalCount;

    private Integer warningCount;

    private Integer infoCount;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "result_json")
    private String resultJson;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public Analysis(Long projectId, AnalysisStatus status, String externalId, LocalDateTime startedAt) {
        this.projectId = projectId;
        this.status = status == null ? AnalysisStatus.QUEUED : status;
        this.externalId = externalId;
        this.startedAt = startedAt;
    }

    public void complete(String summary, String resultJson) {
        this.status = AnalysisStatus.COMPLETED;
        this.completedAt = LocalDateTime.now();
        this.summary = truncate(summary);
        this.resultJson = resultJson;
    }

    public void applyOverview(Integer score, String grade, Integer critical, Integer warning, Integer info) {
        this.score = score;
        this.grade = grade;
        this.criticalCount = critical;
        this.warningCount = warning;
        this.infoCount = info;
    }

    public void fail(String reason) {
        this.status = AnalysisStatus.FAILED;
        this.completedAt = LocalDateTime.now();
        this.summary = truncate(reason);
    }

    public void attachExternalId(String externalId) {
        this.externalId = externalId;
    }

    public boolean isRunning() {
        return status == AnalysisStatus.QUEUED || status == AnalysisStatus.ANALYZING;
    }

    private static String truncate(String value) {
        return value != null && value.length() > 4000 ? value.substring(0, 4000) : value;
    }

    public void changeStatus(AnalysisStatus status) {
        this.status = status;
    }
}
