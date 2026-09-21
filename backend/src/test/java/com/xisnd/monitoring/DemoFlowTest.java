package com.xisnd.monitoring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:demo-test;DB_CLOSE_DELAY=-1", "app.llm.openai.api-key="})
@AutoConfigureMockMvc(print = org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint.NONE)
@ActiveProfiles({"demo", "test"})
class DemoFlowTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired com.xisnd.monitoring.demo.DemoService demo;
    @Autowired com.xisnd.monitoring.telemetry.MetricPointRepository metrics;
    @Test
    void seed_trigger_preview_ownership_and_recover_are_consistent() throws Exception {
        String token = mapper.readTree(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"admin@xisnd.com\",\"password\":\"test1234\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("token").asText();
        JsonNode seed = call(post("/api/demo/seed"), token);
        JsonNode repeated = call(post("/api/demo/seed"), token);
        assertThat(repeated.path("projectId")).isEqualTo(seed.path("projectId"));
        assertThat(repeated.path("agentId")).isEqualTo(seed.path("agentId"));
        long project = seed.path("projectId").asLong();
        long metricCount = metrics.count();
        org.springframework.test.util.ReflectionTestUtils.setField(demo, "heartbeatEnabled", false);
        demo.heartbeat();
        assertThat(metrics.count()).isEqualTo(metricCount);
        org.springframework.test.util.ReflectionTestUtils.setField(demo, "heartbeatEnabled", true);
        JsonNode credential = call(post("/api/demo/projects/" + project + "/agent-token"), token);
        JsonNode rotated = call(post("/api/demo/projects/" + project + "/agent-token"), token);
        assertThat(rotated.path("agentId")).isEqualTo(seed.path("agentId"));
        assertThat(credential.path("token").asText().equals(rotated.path("token").asText())).isFalse();
        assertThat(metrics.count()).isEqualTo(metricCount);
        assertThat(call(get("/api/projects/" + project + "/agents"), token).size()).isEqualTo(1);
        mvc.perform(post("/api/ingest/heartbeat").header("X-Agent-Token", credential.path("token").asText())
            .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/ingest/heartbeat").header("X-Agent-Token", rotated.path("token").asText())
            .contentType(MediaType.APPLICATION_JSON).content("{\"hostname\":\"wallpad-demo-01\"}")).andExpect(status().isOk());
        mvc.perform(post("/api/demo/projects/999999/agent-token").header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
        assertThat(call(get("/api/projects/" + project + "/log-entries"), token).size()).isEqualTo(12);
        assertThat(call(get("/api/projects/" + project + "/metrics?minutes=60"), token).path("series").get(0).path("points").size()).isGreaterThanOrEqualTo(59);
        assertThat(call(get("/api/monitoring/overview"), token).path("agentsOnline").asInt()).isEqualTo(1);
        long start = System.nanoTime();
        JsonNode incident = call(post("/api/demo/projects/" + project + "/trigger").contentType(MediaType.APPLICATION_JSON).content("{\"scenario\":\"LATENCY\"}"), token);
        assertThat((System.nanoTime()-start)/1_000_000).isLessThan(10000);
        assertThat(incident.path("insight").path("source").asText()).isEqualTo("LOCAL");
        assertThat(incident.path("insight").path("currentResponseMs").asInt()).isEqualTo(3200);
        assertThat(incident.path("insight").path("timeoutCount").asInt()).isEqualTo(8);
        assertThat(incident.path("insight").path("errorCount").asInt()).isEqualTo(3);
        JsonNode duplicate = call(post("/api/demo/projects/" + project + "/trigger").contentType(MediaType.APPLICATION_JSON).content("{\"scenario\":\"LATENCY\"}"), token);
        assertThat(duplicate.path("id")).isEqualTo(incident.path("id"));
        JsonNode preview = call(get("/api/incidents/" + incident.path("id").asLong() + "/preview"), token);
        assertThat(preview.path("externalDelivery").asBoolean()).isFalse();
        assertThat(preview.path("message").asText()).contains("3200", "근거:", "가능 원인:", "권장 조치:");
        assertThat(call(get("/api/dashboard"), token).path("health").path("critical").asInt()).isEqualTo(1);
        String other = mapper.readTree(mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"demo-other@test.com\",\"password\":\"password1\",\"name\":\"Other\"}"))
            .andReturn().getResponse().getContentAsString()).path("token").asText();
        mvc.perform(get("/api/incidents/" + incident.path("id").asLong() + "/preview").header("Authorization", "Bearer " + other)).andExpect(status().isNotFound());
        mvc.perform(post("/api/demo/projects/" + project + "/recover").header("Authorization", "Bearer " + other)).andExpect(status().isNotFound());
        mvc.perform(post("/api/demo/projects/" + project + "/agent-token").header("Authorization", "Bearer " + other)).andExpect(status().isNotFound());
        JsonNode normalProject = mapper.readTree(mvc.perform(post("/api/projects").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Ordinary project\",\"projectCode\":\"NORMAL-DEMO-TEST\",\"technologies\":[]}"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        mvc.perform(post("/api/demo/projects/" + normalProject.path("id").asLong() + "/agent-token").header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/projects/" + normalProject.path("id").asLong()).header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        call(post("/api/demo/projects/" + project + "/recover"), token);
        assertThat(call(post("/api/demo/projects/" + project + "/recover"), token).path("resolved").asInt()).isZero();
        assertThat(call(get("/api/dashboard"), token).path("health").path("normal").asInt()).isEqualTo(1);
        assertThat(call(get("/api/monitoring/overview"), token).path("openIncidents").asInt()).isZero();
        JsonNode spike = call(post("/api/demo/projects/" + project + "/trigger").contentType(MediaType.APPLICATION_JSON).content("{\"scenario\":\"ERROR_SPIKE\"}"), token);
        assertThat(spike.path("insight").path("errorCount").asInt()).isEqualTo(24);
        assertThat(spike.path("insight").path("timeoutCount").asInt()).isEqualTo(2);
        assertThat(spike.path("insight").path("currentResponseMs").asInt()).isEqualTo(450);
        call(post("/api/demo/projects/" + project + "/recover"), token);
        JsonNode trend = call(get("/api/dashboard"), token).path("incidentTrend");
        assertThat(trend.get(6).path("opened").asInt()).isEqualTo(2);
        assertThat(trend.get(6).path("resolved").asInt()).isEqualTo(2);
    }
    private JsonNode call(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String token) throws Exception {
        return mapper.readTree(mvc.perform(request.header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
}
