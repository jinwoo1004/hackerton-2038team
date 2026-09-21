package com.xisnd.monitoring.incident;

import com.xisnd.monitoring.config.AnalysisServiceProperties;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Component
public class AnomalyClient {

    private final AnalysisServiceProperties properties;
    private final RestTemplate restTemplate;

    public AnomalyClient(AnalysisServiceProperties properties) {
        this.properties = properties;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(2000);
        factory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(factory);
    }

    public List<Anomaly> detect(List<Series> series) {
        if (!properties.enabled() || series.isEmpty()) {
            return List.of();
        }
        try {
            DetectResponse response = restTemplate.postForObject(
                    properties.baseUrl() + "/anomaly/detect", new DetectRequest(series), DetectResponse.class);
            return response == null || response.anomalies() == null ? List.of() : response.anomalies();
        } catch (RestClientException e) {
            log.debug("추세 이상 탐지 호출 실패: {}", e.getMessage());
            return List.of();
        }
    }

    public record Series(String key, List<Double> values, double minDelta) {
    }

    public record DetectRequest(List<Series> series) {
    }

    public record Anomaly(String key, double value, double baseline, double score) {
    }

    public record DetectResponse(List<Anomaly> anomalies) {
    }
}
