package com.xisnd.monitoring.analysis.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.xisnd.monitoring.analysis.Analysis;
import com.xisnd.monitoring.analysis.AnalysisStatus;
import java.time.LocalDateTime;

public record AnalysisResponse(
        Long id,
        Long projectId,
        AnalysisStatus status,
        LocalDateTime startedAt,
        LocalDateTime completedAt,
        String summary,
        LocalDateTime createdAt,
        Integer score,
        String grade,
        Integer criticalCount,
        Integer warningCount,
        Integer infoCount,
        JsonNode result) {

    // 이력 목록은 결과 본문 없이 내려준다
    public static AnalysisResponse from(Analysis analysis) {
        return from(analysis, null);
    }

    public static AnalysisResponse from(Analysis analysis, JsonNode result) {
        return new AnalysisResponse(
                analysis.getId(),
                analysis.getProjectId(),
                analysis.getStatus(),
                analysis.getStartedAt(),
                analysis.getCompletedAt(),
                analysis.getSummary(),
                analysis.getCreatedAt(),
                analysis.getScore(),
                analysis.getGrade(),
                analysis.getCriticalCount(),
                analysis.getWarningCount(),
                analysis.getInfoCount(),
                result);
    }
}
