package com.xisnd.monitoring.alert;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
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
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Getter
@Entity
@Table(name = "alert_channel", indexes = @Index(name = "idx_channel_user", columnList = "userId"))
@EntityListeners(AuditingEntityListener.class)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AlertChannel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private AlertChannelType type;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(nullable = false, length = 500)
    private String target;

    @Column(nullable = false)
    private boolean enabled;

    private LocalDateTime lastSentAt;

    @Column(length = 300)
    private String lastError;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public AlertChannel(Long userId, AlertChannelType type, String name, String target) {
        this.userId = userId;
        this.type = type;
        this.name = name;
        this.target = target;
        this.enabled = true;
    }

    public void update(String name, String target, Boolean enabled) {
        if (name != null && !name.isBlank()) {
            this.name = name.trim();
        }
        if (target != null && !target.isBlank()) {
            this.target = target.trim();
        }
        if (enabled != null) {
            this.enabled = enabled;
        }
    }

    public void recordResult(LocalDateTime at, String error) {
        if (error == null) {
            this.lastSentAt = at;
            this.lastError = null;
        } else {
            this.lastError = error.length() > 300 ? error.substring(0, 300) : error;
        }
    }
}
