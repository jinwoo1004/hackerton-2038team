package com.xisnd.monitoring.alert;

import com.xisnd.monitoring.incident.IncidentRule;
import com.xisnd.monitoring.incident.IncidentSeverity;
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
import java.time.LocalTime;
import java.util.Arrays;
import java.util.Collection;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;
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
@Table(name = "alert_rule", indexes = @Index(name = "idx_rule_user", columnList = "userId"))
@EntityListeners(AuditingEntityListener.class)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AlertRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 80)
    private String name;

    private Long projectId;

    @Column(nullable = false)
    private Long channelId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 10)
    private IncidentSeverity minSeverity;

    @Column(length = 300)
    private String incidentRules;

    @Column(nullable = false)
    private boolean notifyResolved;

    private LocalTime quietStart;

    private LocalTime quietEnd;

    @Column(nullable = false)
    private boolean enabled;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public AlertRule(Long userId, String name, Long projectId, Long channelId, IncidentSeverity minSeverity,
                     Collection<IncidentRule> rules, boolean notifyResolved, LocalTime quietStart, LocalTime quietEnd) {
        this.userId = userId;
        this.enabled = true;
        apply(name, projectId, channelId, minSeverity, rules, notifyResolved, quietStart, quietEnd);
    }

    public void apply(String name, Long projectId, Long channelId, IncidentSeverity minSeverity,
                      Collection<IncidentRule> rules, boolean notifyResolved, LocalTime quietStart, LocalTime quietEnd) {
        this.name = name.trim();
        this.projectId = projectId;
        this.channelId = channelId;
        this.minSeverity = minSeverity == null ? IncidentSeverity.WARNING : minSeverity;
        this.incidentRules = rules == null || rules.isEmpty() ? null
                : rules.stream().map(Enum::name).sorted().collect(Collectors.joining(","));
        this.notifyResolved = notifyResolved;
        this.quietStart = quietStart;
        this.quietEnd = quietEnd;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public Set<IncidentRule> ruleSet() {
        if (incidentRules == null || incidentRules.isBlank()) {
            return EnumSet.noneOf(IncidentRule.class);
        }
        return Arrays.stream(incidentRules.split(","))
                .map(IncidentRule::valueOf)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(IncidentRule.class)));
    }

    public boolean matches(Long projectId, IncidentRule rule, IncidentSeverity severity) {
        if (!enabled) {
            return false;
        }
        if (this.projectId != null && !this.projectId.equals(projectId)) {
            return false;
        }
        if (minSeverity == IncidentSeverity.CRITICAL && severity != IncidentSeverity.CRITICAL) {
            return false;
        }
        Set<IncidentRule> rules = ruleSet();
        return rules.isEmpty() || rules.contains(rule);
    }

    // 밤 10시부터 아침 7시처럼 자정을 넘기는 구간도 있다
    public boolean isQuiet(LocalTime now) {
        if (quietStart == null || quietEnd == null || quietStart.equals(quietEnd)) {
            return false;
        }
        if (quietStart.isBefore(quietEnd)) {
            return !now.isBefore(quietStart) && now.isBefore(quietEnd);
        }
        return !now.isBefore(quietStart) || now.isBefore(quietEnd);
    }
}
