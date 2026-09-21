package com.xisnd.monitoring.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.analysis-service")
public record AnalysisServiceProperties(boolean enabled, String baseUrl, int timeoutSeconds) {

    public AnalysisServiceProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "http://localhost:8000";
        }
        if (timeoutSeconds <= 0) {
            timeoutSeconds = 600;
        }
    }
}
