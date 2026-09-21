package com.xisnd.monitoring.analysis.dto;

import java.util.List;
import java.util.Map;

// fileNames 는 저장 경로별 원래 파일명
public record AnalysisServiceRequest(
        Long projectId,
        String projectCode,
        List<String> technologies,
        List<String> ruleFiles,
        String sourceFile,
        List<String> logFiles,
        Map<String, String> fileNames) {
}
