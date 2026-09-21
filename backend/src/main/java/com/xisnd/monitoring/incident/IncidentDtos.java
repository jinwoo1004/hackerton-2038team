package com.xisnd.monitoring.incident;

import com.xisnd.monitoring.project.Project;
import java.time.LocalDateTime;

public final class IncidentDtos {

    private IncidentDtos() {
    }

    public record IncidentResponse(
            Long id,
            Long projectId,
            String projectName,
            String projectCode,
            Long agentId,
            String agentName,
            IncidentRule rule,
            String ruleLabel,
            IncidentSeverity severity,
            IncidentStatus status,
            String title,
            String detail,
            Double observed,
            Double threshold,
            LocalDateTime openedAt,
            LocalDateTime lastDetectedAt,
            LocalDateTime resolvedAt,
            String resolvedBy,
            com.xisnd.monitoring.alert.IncidentInsight.Insight insight) {

        public static IncidentResponse of(Incident i, Project p, String agentName) {
            return new IncidentResponse(i.getId(), i.getProjectId(), p == null ? null : p.getName(),
                    p == null ? null : p.getProjectCode(), i.getAgentId(), agentName, i.getRule(), i.getRule().label(),
                    i.getSeverity(), i.getStatus(), i.getTitle(), i.getDetail(), i.getObserved(), i.getThreshold(),
                    i.getOpenedAt(), i.getLastDetectedAt(), i.getResolvedAt(), i.getResolvedBy(),
                    com.xisnd.monitoring.alert.IncidentInsight.read(i.getInsightJson()));
        }
    }
}
