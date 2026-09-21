package com.xisnd.monitoring.analysis.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record AnalysisServiceResponse(
        String analysisId,
        String status,
        String projectCode,
        String summary,
        JsonNode result) {
}
