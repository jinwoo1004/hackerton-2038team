package com.xisnd.monitoring.agent;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
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
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Getter
@Entity
@Table(name = "agent", indexes = @Index(name = "idx_agent_project", columnList = "projectId"))
@EntityListeners(AuditingEntityListener.class)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Agent {

    public static final int OFFLINE_AFTER_SECONDS = 120;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long projectId;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(nullable = false, length = 12)
    private String tokenPrefix;

    @Column(length = 120)
    private String hostname;

    @Column(length = 120)
    private String os;

    @Column(length = 30)
    private String agentVersion;

    @Column(length = 60)
    private String ipAddress;

    private LocalDateTime lastSeenAt;

    @Column(nullable = false)
    private boolean connected;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public Agent(Long projectId, String name, String tokenHash, String tokenPrefix) {
        this.projectId = projectId;
        this.name = name;
        this.tokenHash = tokenHash;
        this.tokenPrefix = tokenPrefix;
    }

    public boolean touch(String hostname, String os, String agentVersion, String ipAddress, LocalDateTime now) {
        if (hostname != null && !hostname.isBlank()) {
            this.hostname = cut(hostname, 120);
        }
        if (os != null && !os.isBlank()) {
            this.os = cut(os, 120);
        }
        if (agentVersion != null && !agentVersion.isBlank()) {
            this.agentVersion = cut(agentVersion, 30);
        }
        if (ipAddress != null && !ipAddress.isBlank()) {
            this.ipAddress = cut(ipAddress, 60);
        }
        this.lastSeenAt = now;
        boolean reconnected = !connected;
        this.connected = true;
        return reconnected;
    }

    public void markDisconnected() {
        this.connected = false;
    }

    public AgentState state(LocalDateTime now) {
        if (lastSeenAt == null) {
            return AgentState.PENDING;
        }
        return lastSeenAt.isAfter(now.minusSeconds(OFFLINE_AFTER_SECONDS)) ? AgentState.ONLINE : AgentState.OFFLINE;
    }

    private static String cut(String value, int max) {
        String v = value.trim();
        return v.length() > max ? v.substring(0, max) : v;
    }
}
