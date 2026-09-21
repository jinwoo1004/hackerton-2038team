package com.xisnd.monitoring.alert;

import com.xisnd.monitoring.incident.IncidentRule;
import com.xisnd.monitoring.incident.IncidentSeverity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public final class AlertDtos {

    private AlertDtos() {
    }

    public record ChannelRequest(
            @NotBlank(message = "채널 이름을 입력해주세요.")
            @Size(max = 60, message = "채널 이름은 60자 이내로 입력해주세요.")
            String name,
            AlertChannelType type,
            String webhookUrl,
            Boolean enabled) {
    }

    public record ChannelResponse(Long id, AlertChannelType type, String name, String target, boolean enabled,
                                  LocalDateTime lastSentAt, String lastError, LocalDateTime createdAt) {

        public static ChannelResponse from(AlertChannel c) {
            return new ChannelResponse(c.getId(), c.getType(), c.getName(), mask(c.getTarget()), c.isEnabled(),
                    c.getLastSentAt(), c.getLastError(), c.getCreatedAt());
        }

        static String mask(String url) {
            if (url == null || url.length() < 16) {
                return "****";
            }
            int keep = url.indexOf("/services/");
            String head = keep > 0 ? url.substring(0, keep + "/services/".length()) : url.substring(0, 12);
            return head + "****" + url.substring(url.length() - 4);
        }
    }

    public record RuleRequest(
            @NotBlank(message = "규칙 이름을 입력해주세요.")
            @Size(max = 80, message = "규칙 이름은 80자 이내로 입력해주세요.")
            String name,
            Long projectId,
            @NotNull(message = "알림을 받을 채널을 선택해주세요.")
            Long channelId,
            IncidentSeverity minSeverity,
            List<IncidentRule> rules,
            boolean notifyResolved,
            LocalTime quietStart,
            LocalTime quietEnd,
            Boolean enabled) {
    }

    public record RuleResponse(Long id, String name, Long projectId, String projectName, Long channelId,
                               String channelName, IncidentSeverity minSeverity, List<IncidentRule> rules,
                               boolean notifyResolved, LocalTime quietStart, LocalTime quietEnd, boolean enabled,
                               LocalDateTime createdAt) {
    }

    public record DeliveryResponse(Long id, Long channelId, String channelName, Long incidentId, Long projectId,
                                   DeliveryKind kind, String title, boolean success, String error,
                                   LocalDateTime sentAt) {

        public static DeliveryResponse from(AlertDelivery d) {
            return new DeliveryResponse(d.getId(), d.getChannelId(), d.getChannelName(), d.getIncidentId(),
                    d.getProjectId(), d.getKind(), d.getTitle(), d.isSuccess(), d.getError(), d.getSentAt());
        }
    }

    public record TestResult(boolean success, String error) {
    }
}
