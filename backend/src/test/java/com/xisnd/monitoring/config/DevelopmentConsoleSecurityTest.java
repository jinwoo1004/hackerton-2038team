package com.xisnd.monitoring.config;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xisnd.monitoring.llm.LlmSettings;
import com.xisnd.monitoring.security.JwtAuthenticationFilter;
import com.xisnd.monitoring.security.JwtTokenProvider;
import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

/** Real security filter chain; synthetic routes, no H2 database or model network. */
class DevelopmentConsoleSecurityTest {
    @ParameterizedTest @ValueSource(strings = {"local", "test", "deployed"})
    void h2_console_is_available_only_outside_deployed_runtime(String runtime) {
        var settings = mock(LlmSettings.class); when(settings.runtime()).thenReturn(runtime);
        new WebApplicationContextRunner().withUserConfiguration(SecurityConfig.class, Routes.class)
            .withBean(LlmSettings.class, () -> settings)
            .withBean(ObjectMapper.class, () -> new ObjectMapper().findAndRegisterModules())
            .withBean(CorsProperties.class, () -> new CorsProperties(List.of("http://localhost:3200")))
            .withBean(JwtAuthenticationFilter.class, () -> new JwtAuthenticationFilter(mock(JwtTokenProvider.class)))
            .run(context -> {
                var mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
                if (runtime.equals("deployed")) {
                    mvc.perform(get("/h2-console/probe")).andExpect(status().isUnauthorized());
                    mvc.perform(get("/h2-console/probe").with(user("synthetic"))).andExpect(status().isForbidden());
                } else mvc.perform(get("/h2-console/probe")).andExpect(status().isOk());
                mvc.perform(get("/actuator/probe").with(user("synthetic"))).andExpect(status().isForbidden());
            });
    }
    @Configuration @EnableWebMvc
    static class Routes { @Bean ProbeController probeController() { return new ProbeController(); } }
    @RestController
    static class ProbeController {
        @GetMapping({"/h2-console/probe", "/actuator/probe"}) String probe() { return "ok"; }
    }
}
