package com.xisnd.monitoring.dashboard;

import com.xisnd.monitoring.analysis.AnalysisStatus;
import com.xisnd.monitoring.event.dto.EventResponse;
import com.xisnd.monitoring.project.ProjectStatus;
import java.time.LocalDateTime;
import java.util.List;

public final class DashboardDtos {

    private DashboardDtos() {
    }

    public record ProjectCounts(long total, long ready, long analyzing, long active, long error) {
    }

    public record AnalysisCounts(long total, long running, long completed, long failed, Integer averageScore) {
    }

    public record SeverityCounts(long critical, long warning, long info) {
    }

    public record ProjectHealth(
            Long projectId,
            String name,
            String projectCode,
            ProjectStatus status,
            LocalDateTime lastAnalyzedAt,
            AnalysisStatus latestStatus,
            Integer score,
            String grade,
            Integer critical,
            Integer warning,
            Integer info) {
    }

    public record DashboardResponse(
            ProjectCounts projects,
            long fileCount,
            AnalysisCounts analyses,
            SeverityCounts severity,
            List<ProjectHealth> projectHealth,
            List<EventResponse> recentEvents) {
    }

    public record AnalysisListItem(
            Long id,
            Long projectId,
            String projectName,
            String projectCode,
            AnalysisStatus status,
            LocalDateTime startedAt,
            LocalDateTime completedAt,
            Integer score,
            String grade,
            Integer critical,
            Integer warning,
            Integer info,
            String summary) {
    }

    public record ServiceStatus(String key, String name, String status, String detail, Long latencyMs) {
    }

    public record SystemStatus(List<ServiceStatus> services, LocalDateTime checkedAt) {
    }
}
