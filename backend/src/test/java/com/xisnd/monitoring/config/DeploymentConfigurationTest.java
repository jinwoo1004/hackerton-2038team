package com.xisnd.monitoring.config;

import static org.assertj.core.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class DeploymentConfigurationTest {
    private static final String SECRET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$";
    private Map<String, String> variables() {
        return new HashMap<>(Map.of("APP_RUNTIME", "deployed", "LLM_PROVIDER", "openai_api", "APP_JWT_SECRET", SECRET,
            "APP_ANALYSIS_SHARED_SECRET", SECRET, "DB_URL", "jdbc:mysql://mysql:3306/monitoring", "DB_USERNAME", "monitoring",
            "DB_PASSWORD", "synthetic-db-password", "APP_CORS_ALLOWED_ORIGINS", "https://frontend.invalid",
            "APP_PUBLIC_URL", "https://frontend.invalid", "APP_ANALYSIS_BASE_URL", "http://analysis:8000"));
    }
    private MockEnvironment environment(Map<String, String> env) {
        MockEnvironment result = new MockEnvironment(); result.setActiveProfiles("deployed");
        result.setProperty("app.jwt.secret", env.get("APP_JWT_SECRET"));
        result.setProperty("app.analysis-service.shared-secret", env.get("APP_ANALYSIS_SHARED_SECRET"));
        result.setProperty("spring.datasource.url", env.get("DB_URL"));
        result.setProperty("app.cors.allowed-origins", env.get("APP_CORS_ALLOWED_ORIGINS"));
        result.setProperty("app.alerts.public-url", env.get("APP_PUBLIC_URL"));
        result.setProperty("app.analysis-service.base-url", env.get("APP_ANALYSIS_BASE_URL"));
        return result;
    }
    @Test void explicit_deployment_is_valid_without_database_or_network_access() {
        var env = variables(); assertThatCode(() -> DeploymentConfiguration.validate(env::get, environment(env))).doesNotThrowAnyException();
    }
    @Test void real_base_and_deployed_yaml_bind_the_explicit_cors_list() {
        var env = variables();
        env.put("APP_CORS_ALLOWED_ORIGINS", "https://frontend.invalid,https://preview.invalid");
        List<String> properties = new ArrayList<>();
        properties.add("spring.profiles.active=deployed");
        env.forEach((key, value) -> properties.add(key + "=" + value));
        new org.springframework.boot.test.context.runner.ApplicationContextRunner()
            .withInitializer(new org.springframework.boot.test.context.ConfigDataApplicationContextInitializer())
            .withPropertyValues(properties.toArray(String[]::new))
            .run(context -> {
                assertThat(context).hasNotFailed();
                DeploymentConfiguration.validate(env::get, context.getEnvironment());
                var cors = org.springframework.boot.context.properties.bind.Binder.get(context.getEnvironment())
                    .bind("app.cors.allowed-origins", org.springframework.boot.context.properties.bind.Bindable.listOf(String.class)).get();
                assertThat(cors).containsExactly("https://frontend.invalid", "https://preview.invalid");
                assertThat(context.getEnvironment().getProperty("app.storage.location")).isEqualTo("/data/storage");
            });
    }
    @Test void every_required_setting_is_required_and_errors_never_contain_values() {
        for (String key : variables().keySet()) {
            if (key.equals("APP_RUNTIME")) continue;
            var env = variables(); var spring = environment(env); env.remove(key);
            assertThatThrownBy(() -> DeploymentConfiguration.validate(env::get, spring)).isInstanceOf(IllegalStateException.class)
                .hasMessageNotContaining(SECRET).hasMessageNotContaining("synthetic-db-password");
        }
    }
    @Test void demo_local_and_test_profiles_weak_jwt_and_property_overrides_are_rejected() {
        var env = variables();
        for (String profile : List.of("local", "demo", "test")) {
            var spring = environment(env); spring.setActiveProfiles("deployed", profile);
            assertThatThrownBy(() -> DeploymentConfiguration.validate(env::get, spring)).hasMessageContaining("profile");
        }
        for (String value : List.of("short", "a".repeat(64), "local-development-only-secret-key-change-me-please")) {
            var weak = variables(); weak.put("APP_JWT_SECRET", value);
            assertThatThrownBy(() -> DeploymentConfiguration.validate(weak::get, environment(weak))).hasMessageContaining("APP_JWT_SECRET");
        }
        for (String property : List.of("app.jwt.secret", "app.analysis-service.shared-secret", "spring.datasource.url", "app.cors.allowed-origins", "app.analysis-service.base-url", "app.alerts.public-url")) {
            var spring = environment(env); spring.setProperty(property, "untrusted-override");
            assertThatThrownBy(() -> DeploymentConfiguration.validate(env::get, spring)).isInstanceOf(IllegalStateException.class);
        }
    }
    @Test void wildcard_and_non_https_browser_origins_are_rejected_but_local_mode_is_unchanged() {
        for (String origin : List.of("*", "https://*.invalid", "http://frontend.invalid", "https://frontend.invalid/path", "https://user:pass@frontend.invalid", "https://frontend.invalid,")) {
            var env = variables(); env.put("APP_CORS_ALLOWED_ORIGINS", origin);
            assertThatThrownBy(() -> DeploymentConfiguration.validate(env::get, environment(env))).hasMessageContaining("APP_CORS_ALLOWED_ORIGINS");
        }
        assertThatCode(() -> DeploymentConfiguration.validate(name -> name.equals("APP_RUNTIME") ? "local" : null, new MockEnvironment())).doesNotThrowAnyException();
    }
}
