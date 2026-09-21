package com.xisnd.monitoring;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
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
class AuthAndProjectFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void 인증없이_프로젝트를_조회하면_401() throws Exception {
        mockMvc.perform(get("/api/projects")).andExpect(status().isUnauthorized());
    }

    @Test
    void 회원가입_후_프로젝트를_생성하고_조회한다() throws Exception {
        String signup = """
                {"name":"홍길동","email":"tester@xisnd.com","password":"test1234","company":"XISND"}
                """;
        String body = mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signup))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode json = objectMapper.readTree(body);
        String token = json.get("token").asText();

        String project = """
                {"name":"TREECS","nickname":"수목 관리 플랫폼","projectCode":"TREECS",
                 "description":"수목 데이터와 도면을 관리하는 사내 플랫폼",
                 "technologies":[{"category":"LANGUAGE","name":"Java"},{"category":"FRAMEWORK","name":"Spring Boot"}]}
                """;
        mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(project))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.projectCode").value("TREECS"))
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.technologies.length()").value(2));

        mockMvc.perform(get("/api/projects").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(get("/api/projects/check-code?code=TREECS")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false));
    }

    @Test
    void 중복_이메일로_가입하면_409() throws Exception {
        String signup = """
                {"name":"중복","email":"dup@xisnd.com","password":"test1234"}
                """;
        mockMvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(signup))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(signup))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("이미 가입된 이메일입니다."));
    }
}
