package com.xisnd.monitoring.telemetry;

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
@Table(name = "log_entry", indexes = {
        @Index(name = "idx_log_project_time", columnList = "projectId, loggedAt"),
        @Index(name = "idx_log_agent_time", columnList = "agentId, loggedAt"),
        @Index(name = "idx_log_project_fp", columnList = "projectId, fingerprint")
})
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LogEntry {

    public static final int MAX_MESSAGE = 4000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long projectId;

    @Column(nullable = false)
    private Long agentId;

    @Column(length = 255)
    private String source;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 10)
    private LogLevel level;

    @Column(nullable = false, length = MAX_MESSAGE)
    private String message;

    @Column(length = 16)
    private String fingerprint;

    @Column(nullable = false)
    private LocalDateTime loggedAt;

    @Column(nullable = false)
    private LocalDateTime receivedAt;

    @Builder
    public LogEntry(Long projectId, Long agentId, String source, LogLevel level, String message,
                    String fingerprint, LocalDateTime loggedAt, LocalDateTime receivedAt) {
        this.projectId = projectId;
        this.agentId = agentId;
        this.source = source;
        this.level = level;
        this.message = message;
        this.fingerprint = fingerprint;
        this.loggedAt = loggedAt;
        this.receivedAt = receivedAt;
    }
}
