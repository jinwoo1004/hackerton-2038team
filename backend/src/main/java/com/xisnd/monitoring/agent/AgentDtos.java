package com.xisnd.monitoring.agent;

import com.xisnd.monitoring.telemetry.MetricPoint;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

public final class AgentDtos {

    private AgentDtos() {
    }

    public record AgentCreateRequest(
            @NotBlank(message = "에이전트 이름을 입력해주세요.")
            @Size(max = 80, message = "에이전트 이름은 80자 이내로 입력해주세요.")
            String name) {
    }

    public record MetricSnapshot(LocalDateTime collectedAt, Double cpuPct, Double memoryPct, Double diskPct,
                                 Double netInKbps, Double netOutKbps) {

        public static MetricSnapshot from(MetricPoint m) {
            return new MetricSnapshot(m.getCollectedAt(), m.getCpuPct(), m.getMemoryPct(), m.getDiskPct(),
                    m.getNetInKbps(), m.getNetOutKbps());
        }
    }

    public record AgentResponse(
            Long id,
            Long projectId,
            String name,
            String tokenPrefix,
            String hostname,
            String os,
            String agentVersion,
            String ipAddress,
            AgentState state,
            LocalDateTime lastSeenAt,
            LocalDateTime createdAt,
            MetricSnapshot latest) {

        public static AgentResponse of(Agent a, LocalDateTime now, MetricSnapshot latest) {
            return new AgentResponse(a.getId(), a.getProjectId(), a.getName(), a.getTokenPrefix(), a.getHostname(),
                    a.getOs(), a.getAgentVersion(), a.getIpAddress(), a.state(now), a.getLastSeenAt(),
                    a.getCreatedAt(), latest);
        }
    }

    public record AgentCreatedResponse(AgentResponse agent, String token) {
    }
}
