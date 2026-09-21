package com.xisnd.monitoring.alert;

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
@Table(name = "alert_delivery", indexes = {
        @Index(name = "idx_delivery_user_time", columnList = "userId, sentAt"),
        @Index(name = "idx_delivery_dedup", columnList = "channelId, dedupKey, sentAt")
})
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AlertDelivery {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Long channelId;

    @Column(nullable = false, length = 60)
    private String channelName;

    private Long ruleId;

    private Long incidentId;

    private Long projectId;

    @Column(length = 160)
    private String dedupKey;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 12)
    private DeliveryKind kind;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false)
    private boolean success;

    @Column(length = 300)
    private String error;

    @Column(nullable = false)
    private LocalDateTime sentAt;

    @Builder
    public AlertDelivery(Long userId, Long channelId, String channelName, Long ruleId, Long incidentId,
                         Long projectId, String dedupKey, DeliveryKind kind, String title, boolean success,
                         String error, LocalDateTime sentAt) {
        this.userId = userId;
        this.channelId = channelId;
        this.channelName = channelName;
        this.ruleId = ruleId;
        this.incidentId = incidentId;
        this.projectId = projectId;
        this.dedupKey = dedupKey;
        this.kind = kind;
        this.title = title.length() > 200 ? title.substring(0, 200) : title;
        this.success = success;
        this.error = error == null ? null : error.length() > 300 ? error.substring(0, 300) : error;
        this.sentAt = sentAt;
    }
}
