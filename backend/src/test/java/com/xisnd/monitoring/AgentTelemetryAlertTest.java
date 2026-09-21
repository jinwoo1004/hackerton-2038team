package com.xisnd.monitoring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import com.xisnd.monitoring.incident.IncidentDetector;
import java.io.ByteArrayOutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.zip.GZIPOutputStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AgentTelemetryAlertTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private IncidentDetector detector;

    private HttpServer slack;
    private final List<String> received = new CopyOnWriteArrayList<>();

    @BeforeEach
    void startSlack() throws Exception {
        slack = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        slack.createContext("/hook", exchange -> {
            received.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] ok = "ok".getBytes();
            exchange.sendResponseHeaders(200, ok.length);
            exchange.getResponseBody().write(ok);
            exchange.close();
        });
        slack.start();
    }

    @AfterEach
    void stopSlack() {
        slack.stop(0);
    }

    @Test
    void 에이전트_토큰으로_로그와_지표를_받고_조회한다() throws Exception {
        String user = signup("agent-flow@xisnd.com");
        long projectId = createProject(user, "AGT01");

        JsonNode created = json(mockMvc.perform(post("/api/projects/" + projectId + "/agents")
                        .header("Authorization", "Bearer " + user)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"web-01\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.agent.state").value("PENDING"))
                .andReturn().getResponse().getContentAsString());
        String token = created.get("token").asText();
        assertThat(token).startsWith("agt_");
        assertThat(created.get("agent").get("tokenPrefix").asText()).isEqualTo(token.substring(0, 12));

        mockMvc.perform(post("/api/ingest/heartbeat").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/ingest/heartbeat").header("X-Agent-Token", "agt_wrong")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("에이전트 토큰이 올바르지 않습니다."));

        mockMvc.perform(post("/api/ingest/heartbeat").header("X-Agent-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"hostname\":\"WEB-01\",\"os\":\"Windows Server 2022\",\"agentVersion\":\"1.0.0\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectCode").value("AGT01"));

        String now = OffsetDateTime.now().toString();
        String logs = "{\"entries\":["
                + "{\"timestamp\":\"" + now + "\",\"level\":\"INFO\",\"source\":\"app.log\",\"message\":\"server started\"},"
                + "{\"timestamp\":\"" + now + "\",\"level\":\"warning\",\"source\":\"app.log\",\"message\":\"slow query 1200ms\"},"
                + "{\"timestamp\":\"" + now + "\",\"level\":\"ERROR\",\"source\":\"app.log\",\"message\":\"NullPointerException at OrderService\"},"
                + "{\"level\":\"INFO\",\"message\":\"   \"}"
                + "]}";
        mockMvc.perform(post("/api/ingest/logs").header("X-Agent-Token", token)
                        .header("Content-Encoding", "gzip")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(gzip(logs)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accepted").value(3))
                .andExpect(jsonPath("$.rejected").value(1));

        mockMvc.perform(post("/api/ingest/metrics").header("X-Agent-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"points\":[{\"timestamp\":\"" + now + "\",\"cpuPct\":35.5,\"memoryPct\":61,\"diskPct\":140}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accepted").value(1));

        mockMvc.perform(get("/api/projects/" + projectId + "/log-entries?level=WARN").header("Authorization", "Bearer " + user))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].level").value("ERROR"))
                .andExpect(jsonPath("$[0].agentName").value("web-01"));
        mockMvc.perform(get("/api/projects/" + projectId + "/log-entries?q=slow").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].level").value("WARN"));

        mockMvc.perform(get("/api/projects/" + projectId + "/metrics?minutes=60").header("Authorization", "Bearer " + user))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bucketSeconds").value(60))
                .andExpect(jsonPath("$.series[0].agentName").value("web-01"))
                .andExpect(jsonPath("$.series[0].points[0].cpuPct").value(35.5))
                .andExpect(jsonPath("$.series[0].points[0].diskPct").value(100.0));

        mockMvc.perform(get("/api/projects/" + projectId + "/agents").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$[0].state").value("ONLINE"))
                .andExpect(jsonPath("$[0].hostname").value("WEB-01"))
                .andExpect(jsonPath("$[0].latest.cpuPct").value(35.5));

        mockMvc.perform(get("/api/monitoring/overview").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$.agentsTotal").value(1))
                .andExpect(jsonPath("$.agentsOnline").value(1))
                .andExpect(jsonPath("$.errors1h").value(1))
                .andExpect(jsonPath("$.projects[0].logs1h.warn").value(1));

        mockMvc.perform(get("/api/system/status").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$.services[3].status").value("UP"))
                .andExpect(jsonPath("$.services[3].detail").value("온라인 1 / 전체 1"));

        mockMvc.perform(get("/api/events").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$.items[0].type").value("AGENT_CONNECTED"));

        String other = signup("agent-other@xisnd.com");
        mockMvc.perform(get("/api/projects/" + projectId + "/log-entries").header("Authorization", "Bearer " + other))
                .andExpect(status().isNotFound());

        long agentId = created.get("agent").get("id").asLong();
        mockMvc.perform(delete("/api/projects/" + projectId + "/agents/" + agentId).header("Authorization", "Bearer " + user))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/ingest/heartbeat").header("X-Agent-Token", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/projects/" + projectId + "/log-entries").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void 이상을_찾아_Slack_으로_알리고_해결되면_다시_알린다() throws Exception {
        String user = signup("alert-flow@xisnd.com");
        long projectId = createProject(user, "ALT01");
        String token = json(mockMvc.perform(post("/api/projects/" + projectId + "/agents")
                        .header("Authorization", "Bearer " + user)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"api-01\"}"))
                .andReturn().getResponse().getContentAsString()).get("token").asText();

        mockMvc.perform(post("/api/alerts/channels").header("Authorization", "Bearer " + user)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"운영팀\",\"webhookUrl\":\"https://example.com/hook\"}"))
                .andExpect(status().isBadRequest());

        String hook = "http://127.0.0.1:" + slack.getAddress().getPort() + "/hook";
        JsonNode channel = json(mockMvc.perform(post("/api/alerts/channels").header("Authorization", "Bearer " + user)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"운영팀\",\"webhookUrl\":\"" + hook + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
        assertThat(channel.get("target").asText()).contains("****").doesNotContain("/hook");
        long channelId = channel.get("id").asLong();

        mockMvc.perform(post("/api/alerts/channels/" + channelId + "/test").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$.success").value(true));
        assertThat(received).hasSize(1);
        assertThat(received.get(0)).contains("[테스트]");

        mockMvc.perform(post("/api/alerts/rules").header("Authorization", "Bearer " + user)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"CPU 알림\",\"projectId\":" + projectId + ",\"channelId\":" + channelId
                                + ",\"minSeverity\":\"WARNING\",\"rules\":[\"CPU_HIGH\",\"ERROR_BURST\"],\"notifyResolved\":true}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.channelName").value("운영팀"))
                .andExpect(jsonPath("$.rules.length()").value(2));

        mockMvc.perform(post("/api/ingest/heartbeat").header("X-Agent-Token", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"hostname\":\"API-01\"}"))
                .andExpect(status().isOk());
        sendCpu(token, 99, 98);

        detector.runOnce(LocalDateTime.now());

        mockMvc.perform(get("/api/incidents?status=OPEN").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].rule").value("CPU_HIGH"))
                .andExpect(jsonPath("$[0].severity").value("CRITICAL"))
                .andExpect(jsonPath("$[0].agentName").value("api-01"));
        assertThat(received).hasSize(2);
        assertThat(received.get(1)).contains("[심각]").contains("CPU");

        detector.runOnce(LocalDateTime.now());
        assertThat(received).hasSize(2);

        StringBuilder errors = new StringBuilder("{\"entries\":[");
        for (int i = 0; i < 25; i++) {
            errors.append(i == 0 ? "" : ",").append("{\"level\":\"ERROR\",\"message\":\"timeout calling payment ").append(i).append("\"}");
        }
        mockMvc.perform(post("/api/ingest/logs").header("X-Agent-Token", token)
                        .contentType(MediaType.APPLICATION_JSON).content(errors.append("]}").toString()))
                .andExpect(jsonPath("$.accepted").value(25));
        mockMvc.perform(post("/api/ingest/logs").header("X-Agent-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"entries\":[{\"level\":\"FATAL\",\"message\":\"OutOfMemoryError: Java heap space\"}]}"))
                .andExpect(status().isOk());
        sendCpu(token, 20, 21, 19, 18, 22, 20, 19, 21, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20);

        detector.runOnce(LocalDateTime.now());

        mockMvc.perform(get("/api/incidents?status=OPEN").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.rule == 'ERROR_BURST')]").exists())
                .andExpect(jsonPath("$[?(@.rule == 'FATAL_LOG')].severity").value("CRITICAL"));
        mockMvc.perform(get("/api/incidents?status=RESOLVED").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$[0].rule").value("CPU_HIGH"))
                .andExpect(jsonPath("$[0].resolvedBy").value("AUTO"));
        assertThat(received.stream().filter(r -> r.contains("[해결]")).count()).isEqualTo(1);
        assertThat(received.stream().filter(r -> r.contains("오류 로그")).count()).isEqualTo(1);
        assertThat(received.stream().noneMatch(r -> r.contains("치명 로그"))).isTrue();

        detector.runOnce(LocalDateTime.now().plusMinutes(5));
        mockMvc.perform(get("/api/incidents?status=OPEN").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$[?(@.rule == 'AGENT_DOWN')].severity").value("CRITICAL"));

        mockMvc.perform(get("/api/alerts/deliveries").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$[0].success").value(true));

        long incidentId = json(mockMvc.perform(get("/api/incidents?status=OPEN").header("Authorization", "Bearer " + user))
                .andReturn().getResponse().getContentAsString()).get(0).get("id").asLong();
        mockMvc.perform(post("/api/incidents/" + incidentId + "/resolve").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$.status").value("RESOLVED"))
                .andExpect(jsonPath("$.resolvedBy").value("USER"));

        mockMvc.perform(get("/api/events?level=ERROR").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$.items[?(@.type == 'INCIDENT_OPENED')]").exists());

        mockMvc.perform(delete("/api/projects/" + projectId).header("Authorization", "Bearer " + user))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/incidents").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/alerts/rules").header("Authorization", "Bearer " + user))
                .andExpect(jsonPath("$.length()").value(0));
    }

    private void sendCpu(String token, double... values) throws Exception {
        StringBuilder body = new StringBuilder("{\"points\":[");
        OffsetDateTime base = OffsetDateTime.now().minusSeconds(values.length * 5L);
        for (int i = 0; i < values.length; i++) {
            body.append(i == 0 ? "" : ",")
                    .append("{\"timestamp\":\"").append(base.plusSeconds(i * 5L)).append("\",\"cpuPct\":").append(values[i])
                    .append(",\"memoryPct\":40,\"diskPct\":50}");
        }
        mockMvc.perform(post("/api/ingest/metrics").header("X-Agent-Token", token)
                        .contentType(MediaType.APPLICATION_JSON).content(body.append("]}").toString()))
                .andExpect(status().isOk());
    }

    private long createProject(String token, String code) throws Exception {
        return json(mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"수집 " + code + "\",\"projectCode\":\"" + code + "\",\"technologies\":[]}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    private String signup(String email) throws Exception {
        String body = mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"사용자\",\"email\":\"" + email + "\",\"password\":\"password1\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("token").asText();
    }

    private JsonNode json(String body) throws Exception {
        return objectMapper.readTree(body);
    }

    private static byte[] gzip(String value) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (GZIPOutputStream gz = new GZIPOutputStream(out)) {
            gz.write(value.getBytes(StandardCharsets.UTF_8));
        }
        return out.toByteArray();
    }
}
