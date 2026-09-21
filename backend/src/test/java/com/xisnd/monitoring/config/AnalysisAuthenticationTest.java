package com.xisnd.monitoring.config;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import com.xisnd.monitoring.incident.AnomalyClient;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

class AnalysisAuthenticationTest {
    @Test void internal_http_client_does_not_follow_redirects() throws Exception {
        var connection = org.mockito.Mockito.mock(java.net.HttpURLConnection.class);
        var factory = AnalysisAuthentication.requestFactory();
        var method = factory.getClass().getDeclaredMethod("prepareConnection", java.net.HttpURLConnection.class, String.class);
        method.setAccessible(true); method.invoke(factory, connection, "GET");
        org.mockito.Mockito.verify(connection).setInstanceFollowRedirects(false);
    }
    @Test void analysis_and_anomaly_requests_use_the_same_internal_header() {
        String secret = "synthetic-internal-token-0123456789";
        var properties = new AnalysisServiceProperties(true, "http://analysis.internal", 10, secret);
        RestTemplate client = new RestClientConfig().analysisRestTemplate(new RestTemplateBuilder(), properties);
        var server = MockRestServiceServer.bindTo(client).build();
        for (String path : List.of("/rules/documents", "/analysis"))
            server.expect(requestTo("http://analysis.internal" + path)).andExpect(header("X-Analysis-Token", secret)).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        client.postForObject("http://analysis.internal/rules/documents", "{}", String.class);
        client.postForObject("http://analysis.internal/analysis", "{}", String.class); server.verify();
        var anomaly = new AnomalyClient(properties);
        RestTemplate anomalyClient = (RestTemplate) ReflectionTestUtils.getField(anomaly, "restTemplate");
        var anomalyServer = MockRestServiceServer.bindTo(anomalyClient).build();
        anomalyServer.expect(requestTo("http://analysis.internal/anomaly/detect")).andExpect(header("X-Analysis-Token", secret)).andRespond(withSuccess("{\"anomalies\":[]}", MediaType.APPLICATION_JSON));
        assertThat(anomaly.detect(List.of(new AnomalyClient.Series("cpu", List.of(1.0, 2.0), 1)))).isEmpty();
        anomalyServer.verify(); assertThat(properties.toString()).doesNotContain(secret);
    }
    @Test void local_without_a_shared_secret_keeps_the_existing_contract() {
        RestTemplate client = new RestClientConfig().analysisRestTemplate(new RestTemplateBuilder(), new AnalysisServiceProperties(true, "http://local", 1));
        var server = MockRestServiceServer.bindTo(client).build();
        server.expect(requestTo("http://local/analysis")).andExpect(headerDoesNotExist("X-Analysis-Token")).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        client.postForObject("http://local/analysis", "{}", String.class); server.verify();
    }
}
