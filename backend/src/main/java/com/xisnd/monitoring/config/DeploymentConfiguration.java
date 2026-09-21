package com.xisnd.monitoring.config;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Set;
import java.util.function.Function;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.ConfigurableEnvironment;

/** Runs after config loading but before beans, database connections, or scheduled work. */
public final class DeploymentConfiguration implements ApplicationContextInitializer<ConfigurableApplicationContext> {
    @Override public void initialize(ConfigurableApplicationContext context) {
        validate(System::getenv, context.getEnvironment());
    }
    public static void validate(Function<String, String> variables, ConfigurableEnvironment environment) {
        if (!"deployed".equals(variables.apply("APP_RUNTIME"))) return;
        var profiles = Set.copyOf(Arrays.asList(environment.getActiveProfiles()));
        require(profiles.contains("deployed") && profiles.stream().noneMatch(Set.of("local", "demo", "test")::contains), "profile");
        require("openai_api".equals(variables.apply("LLM_PROVIDER")), "LLM_PROVIDER");
        String jwt = required(variables, "APP_JWT_SECRET");
        require(strongSecret(jwt), "APP_JWT_SECRET");
        String secret = required(variables, "APP_ANALYSIS_SHARED_SECRET");
        require(strongSecret(secret) && secret.matches("[\\x21-\\x7e]+"), "APP_ANALYSIS_SHARED_SECRET");
        require(jwt.equals(environment.getProperty("app.jwt.secret")), "JWT override");
        require(secret.equals(environment.getProperty("app.analysis-service.shared-secret")), "analysis credential override");
        String database = required(variables, "DB_URL");
        require(database.startsWith("jdbc:mysql://") && !database.contains("\n") && !database.contains("\r"), "DB_URL");
        required(variables, "DB_USERNAME"); required(variables, "DB_PASSWORD");
        require(database.equals(environment.getProperty("spring.datasource.url")), "database override");
        String publicUrl = required(variables, "APP_PUBLIC_URL");
        require(webUrl(publicUrl, true, false), "APP_PUBLIC_URL");
        String origins = required(variables, "APP_CORS_ALLOWED_ORIGINS");
        for (String origin : origins.split(",", -1)) require(webUrl(origin.trim(), true, true), "APP_CORS_ALLOWED_ORIGINS");
        var expectedOrigins = Arrays.stream(origins.split(",")).map(String::trim).toList();
        var actualOrigins = org.springframework.boot.context.properties.bind.Binder.get(environment)
            .bind("app.cors.allowed-origins", org.springframework.boot.context.properties.bind.Bindable.listOf(String.class)).orElse(java.util.List.of());
        require(expectedOrigins.equals(actualOrigins), "CORS override");
        String analysisUrl = required(variables, "APP_ANALYSIS_BASE_URL");
        require(webUrl(analysisUrl, false, false), "APP_ANALYSIS_BASE_URL");
        require(analysisUrl.equals(environment.getProperty("app.analysis-service.base-url")), "analysis URL override");
        require(publicUrl.equals(environment.getProperty("app.alerts.public-url")), "public URL override");
        require(!Boolean.parseBoolean(environment.getProperty("spring.h2.console.enabled", "false")), "H2 console");
    }
    private static String required(Function<String, String> variables, String name) {
        String value = variables.apply(name); require(value != null && !value.isBlank(), name); return value;
    }
    static boolean strongSecret(String value) {
        return value != null && value.getBytes(StandardCharsets.UTF_8).length >= 32
            && value.length() <= 8192 && value.chars().distinct().count() >= 12
            && !value.toLowerCase(java.util.Locale.ROOT).matches(".*(change.?me|placeholder|local-development|example|test1234).*" );
    }
    private static boolean webUrl(String value, boolean https, boolean originOnly) {
        try {
            URI uri = URI.create(value);
            return (https ? "https".equals(uri.getScheme()) : Set.of("http", "https").contains(uri.getScheme()))
                && uri.getHost() != null && uri.getUserInfo() == null && uri.getQuery() == null && uri.getFragment() == null
                && (!originOnly || uri.getPath().isEmpty());
        } catch (RuntimeException ignored) { return false; }
    }
    private static void require(boolean condition, String field) {
        if (!condition) throw new IllegalStateException("Deployment configuration is invalid: " + field);
    }
}
