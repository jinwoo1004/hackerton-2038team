package com.xisnd.monitoring;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xisnd.monitoring.llm.StructuredLlm;
import com.xisnd.monitoring.llm.LlmException;
import com.xisnd.monitoring.alert.IncidentInsight;
import com.xisnd.monitoring.agent.AgentRepository;
import com.xisnd.monitoring.telemetry.LogEntryRepository;
import com.xisnd.monitoring.incident.*;
import com.xisnd.monitoring.analysis.AnalysisServiceClient;
import com.xisnd.monitoring.analysis.dto.AnalysisServiceRequest;
import com.xisnd.monitoring.config.AnalysisServiceProperties;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.*;

/** Product contracts use a mocked model and a loopback FastAPI stub; no live model calls. */
class OpenAiContractTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void incident_openai_and_offline_fallback_share_measured_evidence() throws Exception {
            var local = mock(StructuredLlm.class);
            when(local.generate(anyString(), anyString(), any(), anyMap())).thenThrow(new LlmException(LlmException.Code.LOCAL_AUTH_REQUIRED));
            var online = mock(StructuredLlm.class);
            when(online.generate(anyString(), anyString(), any(), anyMap())).thenReturn(mapper.readTree("{\"summary\":\"지연 관측을 확인했습니다.\",\"causes\":[\"연결 대기 가능성\"],\"actions\":[\"연동 로그를 확인하세요.\"]}"));
            Incident incident = incident();
            var service = new IncidentInsight(mock(AgentRepository.class), mock(LogEntryRepository.class), online, mapper);
            service.attach(incident);
            var generated = IncidentInsight.read(incident.getInsightJson());
            assertThat(generated.source()).isEqualTo("OPENAI");
            assertThat(generated.currentResponseMs()).isEqualTo(3200);
            assertThat(generated.evidence()).anyMatch(s -> s.contains("3200"));
            var fallback = new IncidentInsight(mock(AgentRepository.class), mock(LogEntryRepository.class), local, mapper);
            fallback.attach(incident);
            assertThat(IncidentInsight.read(incident.getInsightJson()).source()).isEqualTo("LOCAL");
            assertThat(IncidentInsight.read(incident.getInsightJson()).evidence()).isEqualTo(generated.evidence());
            when(online.generate(anyString(), anyString(), any(), anyMap())).thenThrow(new LlmException(LlmException.Code.TIMEOUT));
            service.attach(incident);
            assertThat(IncidentInsight.read(incident.getInsightJson()).source()).isEqualTo("LOCAL");
    }

    @Test
    void backend_extracts_cited_rules_and_passes_them_to_analysis_service() throws Exception {
        HttpServer stub = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        AtomicReference<String> forwarded = new AtomicReference<>();
        stub.createContext("/rules/documents", exchange -> respond(exchange, "{\"documents\":[{\"name\":\"rules.md\",\"text\":\"Do not use eval\",\"parsed\":true}]}".getBytes(StandardCharsets.UTF_8)));
        stub.createContext("/analysis", exchange -> {
            forwarded.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            respond(exchange, "{\"analysisId\":\"CONTRACT\",\"status\":\"COMPLETED\",\"projectCode\":\"DEMO\"}".getBytes(StandardCharsets.UTF_8));
        });
        stub.start();
        try {
            String base = "http://127.0.0.1:" + stub.getAddress().getPort();
            var provider = mock(StructuredLlm.class);
            when(provider.generate(anyString(), anyString(), any(), anyMap())).thenReturn(mapper.readTree("{\"rules\":[{\"type\":\"forbidden\",\"value\":\"eval\",\"source\":\"rules.md\",\"text\":\"Do not use eval\"}]}"));
            var client = new AnalysisServiceClient(new RestTemplate(), new AnalysisServiceProperties(true, base, 2), provider);
            var request = new AnalysisServiceRequest(1L, "DEMO", List.of(), List.of("rules.md"), "source.zip", List.of(), Map.of());
            assertThat(client.requestAnalysis(request)).isPresent();
            assertThat(mapper.readTree(forwarded.get()).path("ruleExtractionSource").asText()).isEqualTo("OPENAI");
            assertThat(mapper.readTree(forwarded.get()).path("extractedRules").get(0).path("value").asText()).isEqualTo("eval");
        } finally { stub.stop(0); }
    }

    private void respond(com.sun.net.httpserver.HttpExchange exchange, byte[] body) throws java.io.IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, body.length); exchange.getResponseBody().write(body); exchange.close();
    }
    private Incident incident() {
        return Incident.builder().projectId(1L).rule(IncidentRule.LATENCY).severity(IncidentSeverity.CRITICAL).dedupKey("test")
            .title("응답 지연").detail("baselineMs=120 currentMs=3200 timeoutCount=8 errorCount=3").observed(3200.0).threshold(1000.0).openedAt(LocalDateTime.now()).build();
    }
}
