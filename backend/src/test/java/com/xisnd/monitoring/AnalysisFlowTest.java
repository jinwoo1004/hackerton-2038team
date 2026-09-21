package com.xisnd.monitoring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xisnd.monitoring.analysis.AnalysisServiceClient;
import com.xisnd.monitoring.analysis.dto.AnalysisServiceResponse;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AnalysisFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AnalysisServiceClient client;

    @Test
    void 분석을_시작하면_비동기로_결과가_저장된다() throws Exception {
        when(client.isEnabled()).thenReturn(true);
        when(client.requestAnalysis(any())).thenReturn(Optional.of(new AnalysisServiceResponse(
                "ANL-TEST", "COMPLETED", "ANL01", "요약입니다",
                objectMapper.readTree("{\"overview\":{\"score\":91,\"grade\":\"A\"}}"))));

        String token = signup("analysis@xisnd.com");
        long projectId = createProject(token, "ANL01");

        mockMvc.perform(post("/api/projects/{id}/analysis", projectId).header("Authorization", "Bearer " + token))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("QUEUED"));

        JsonNode latest = null;
        for (int i = 0; i < 50; i++) {
            latest = readJson(get("/api/projects/{id}/analysis/latest", projectId), token);
            if ("COMPLETED".equals(latest.path("status").asText())) {
                break;
            }
            Thread.sleep(100);
        }
        assertThat(latest.path("status").asText()).isEqualTo("COMPLETED");
        assertThat(latest.path("summary").asText()).isEqualTo("요약입니다");
        assertThat(latest.path("result").path("overview").path("score").asInt()).isEqualTo(91);

        JsonNode project = readJson(get("/api/projects/{id}", projectId), token);
        assertThat(project.path("status").asText()).isEqualTo("ACTIVE");
        assertThat(project.path("lastAnalyzedAt").isNull()).isFalse();

        JsonNode list = readJson(get("/api/analyses"), token);
        assertThat(list.get(0).path("score").asInt()).isEqualTo(91);
        assertThat(list.get(0).path("grade").asText()).isEqualTo("A");

        long analysisId = list.get(0).path("id").asLong();
        JsonNode one = readJson(get("/api/projects/{id}/analysis/{analysisId}", projectId, analysisId), token);
        assertThat(one.path("result").path("overview").path("score").asInt()).isEqualTo(91);
        mockMvc.perform(get("/api/projects/{id}/analysis/{analysisId}", projectId, analysisId + 999).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());

        JsonNode events = readJson(get("/api/events?projectId={id}", projectId), token);
        assertThat(events.path("items").get(0).path("type").asText()).isEqualTo("ANALYSIS_COMPLETED");
    }

    @Test
    void 분석_서비스가_꺼져_있으면_바로_실패로_남긴다() throws Exception {
        when(client.isEnabled()).thenReturn(false);
        String token = signup("disabled@xisnd.com");
        long projectId = createProject(token, "ANL02");

        mockMvc.perform(post("/api/projects/{id}/analysis", projectId).header("Authorization", "Bearer " + token))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("FAILED"));

        JsonNode project = readJson(get("/api/projects/{id}", projectId), token);
        assertThat(project.path("status").asText()).isEqualTo("READY");
    }

    private String signup(String email) throws Exception {
        String body = mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"분석\",\"email\":\"" + email + "\",\"password\":\"password1\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("token").asText();
    }

    private long createProject(String token, String code) throws Exception {
        String body = mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"분석 테스트\",\"projectCode\":\"" + code + "\","
                                + "\"technologies\":[{\"category\":\"LANGUAGE\",\"name\":\"Java\"}]}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asLong();
    }

    private JsonNode readJson(org.springframework.test.web.servlet.RequestBuilder request, String token) throws Exception {
        String body = mockMvc.perform(((org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder) request)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }
}
