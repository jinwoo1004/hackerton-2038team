package com.xisnd.monitoring.analysis;

import com.xisnd.monitoring.analysis.dto.AnalysisServiceRequest;
import com.xisnd.monitoring.analysis.dto.AnalysisServiceResponse;
import com.xisnd.monitoring.config.AnalysisServiceProperties;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Component
public class AnalysisServiceClient {

    private final RestTemplate restTemplate;
    private final AnalysisServiceProperties properties;

    public AnalysisServiceClient(RestTemplate analysisRestTemplate, AnalysisServiceProperties properties) {
        this.restTemplate = analysisRestTemplate;
        this.properties = properties;
    }

    public boolean isEnabled() {
        return properties.enabled();
    }

    public Optional<AnalysisServiceResponse> requestAnalysis(AnalysisServiceRequest request) {
        if (!properties.enabled()) {
            return Optional.empty();
        }
        try {
            AnalysisServiceResponse response = restTemplate.postForObject(
                    properties.baseUrl() + "/analysis", request, AnalysisServiceResponse.class);
            return Optional.ofNullable(response);
        } catch (RestClientException e) {
            log.warn("분석 서비스 호출 실패 — {}", e.getMessage());
            return Optional.empty();
        }
    }

    // 응답 시간(ms), 실패하면 비어 있음
    public Optional<Long> ping() {
        if (!properties.enabled()) {
            return Optional.empty();
        }
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(2000);
        factory.setReadTimeout(3000);
        long started = System.currentTimeMillis();
        try {
            new RestTemplate(factory).getForObject(properties.baseUrl() + "/health", String.class);
            return Optional.of(System.currentTimeMillis() - started);
        } catch (RestClientException e) {
            return Optional.empty();
        }
    }

    public String baseUrl() {
        return properties.baseUrl();
    }

    public Optional<AnalysisServiceResponse> fetchResult(String analysisId) {
        if (!properties.enabled() || analysisId == null) {
            return Optional.empty();
        }
        try {
            AnalysisServiceResponse response = restTemplate.getForObject(
                    properties.baseUrl() + "/analysis/" + analysisId, AnalysisServiceResponse.class);
            return Optional.ofNullable(response);
        } catch (RestClientException e) {
            log.warn("분석 결과 조회 실패 — {}", e.getMessage());
            return Optional.empty();
        }
    }
}
