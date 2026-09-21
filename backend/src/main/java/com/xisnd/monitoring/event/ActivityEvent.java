package com.xisnd.monitoring.event;

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
@Table(name = "activity_event", indexes = {
        @Index(name = "idx_event_user_created", columnList = "userId, createdAt"),
        @Index(name = "idx_event_project_created", columnList = "projectId, createdAt")
})
@EntityListeners(AuditingEntityListener.class)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ActivityEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    private Long projectId;

    // 프로젝트가 삭제돼도 이름은 남긴다
    @Column(length = 120)
    private String projectName;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 30)
    private EventType type;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 10)
    private EventLevel level;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 1000)
    private String message;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public ActivityEvent(Long userId, Long projectId, String projectName, EventType type, EventLevel level,
                         String title, String message) {
        this.userId = userId;
        this.projectId = projectId;
        this.projectName = projectName;
        this.type = type;
        this.level = level == null ? EventLevel.INFO : level;
        this.title = title;
        this.message = message != null && message.length() > 1000 ? message.substring(0, 1000) : message;
    }
}
