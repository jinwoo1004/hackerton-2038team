package com.xisnd.monitoring;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
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
class DashboardAndAccountTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void 프로젝트를_만들면_이벤트와_대시보드에_반영된다() throws Exception {
        String token = signup("dash@xisnd.com");
        mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"대시보드\",\"projectCode\":\"DASH01\",\"technologies\":[]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recentEventCount").value(1));

        mockMvc.perform(get("/api/events").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].type").value("PROJECT_CREATED"))
                .andExpect(jsonPath("$.items[0].projectName").value("대시보드"));

        mockMvc.perform(get("/api/events?level=ERROR").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.total").value(0));

        mockMvc.perform(get("/api/events?days=7&q=대시&sort=asc").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.total").value(1));
        mockMvc.perform(get("/api/events?q=100%").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.total").value(0));

        mockMvc.perform(get("/api/events/summary?days=7").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.info").value(1))
                .andExpect(jsonPath("$.error").value(0))
                .andExpect(jsonPath("$.last24h").value(1));

        mockMvc.perform(get("/api/dashboard").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projects.total").value(1))
                .andExpect(jsonPath("$.projects.ready").value(1))
                .andExpect(jsonPath("$.projectHealth[0].projectCode").value("DASH01"))
                .andExpect(jsonPath("$.recentEvents.length()").value(1));

        mockMvc.perform(get("/api/analyses").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mockMvc.perform(get("/api/system/status").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.services[0].status").value("UP"))
                .andExpect(jsonPath("$.services[1].key").value("db"));
    }

    @Test
    void 내_정보와_비밀번호를_바꾼다() throws Exception {
        String token = signup("account@xisnd.com");

        mockMvc.perform(put("/api/auth/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"새 이름\",\"company\":\"XISND\",\"department\":\"DX팀\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("새 이름"))
                .andExpect(jsonPath("$.department").value("DX팀"));

        mockMvc.perform(put("/api/auth/password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"wrong-pass\",\"newPassword\":\"newpass123\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("현재 비밀번호가 올바르지 않습니다."));

        mockMvc.perform(put("/api/auth/password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"password1\",\"newPassword\":\"newpass123\"}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"account@xisnd.com\",\"password\":\"newpass123\"}"))
                .andExpect(status().isOk());
    }

    private String signup(String email) throws Exception {
        String body = mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"사용자\",\"email\":\"" + email + "\",\"password\":\"password1\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("token").asText();
    }
}
