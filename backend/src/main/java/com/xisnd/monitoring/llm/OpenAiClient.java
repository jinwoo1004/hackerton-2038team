package com.xisnd.monitoring.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** The backend alone holds credentials. Bounded latency and no request/body logging. */
@Component
public class OpenAiClient {
    private final ObjectMapper mapper;
    private final String key, baseUrl, model;
    private final int timeout;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();

    public OpenAiClient(ObjectMapper mapper, @Value("${app.llm.openai.api-key:}") String key,
            @Value("${app.llm.openai.base-url:https://api.openai.com/v1}") String baseUrl,
            @Value("${app.llm.openai.model:gpt-4.1-mini}") String model,
            @Value("${app.llm.openai.timeout-seconds:4}") int timeout) {
        this.mapper = mapper; this.key = key; this.baseUrl = baseUrl; this.model = model; this.timeout = timeout;
    }

    public boolean enabled() { return key != null && !key.isBlank(); }

    public Optional<JsonNode> generate(String purpose, String instructions, Object input, Map<String, Object> schema) {
        if (!enabled()) return Optional.empty();
        try {
            Map<String, Object> body = Map.of("model", model, "store", false, "instructions", instructions,
                "input", mapper.writeValueAsString(input), "max_output_tokens", 1800,
                "text", Map.of("format", Map.of("type", "json_schema", "name", purpose, "strict", true, "schema", schema)));
            HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl.replaceAll("/+$", "") + "/responses"))
                .timeout(Duration.ofSeconds(Math.min(6, Math.max(1, timeout))))
                .header("Authorization", "Bearer " + key).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) return Optional.empty();
            JsonNode root = mapper.readTree(response.body());
            for (JsonNode output : root.path("output")) for (JsonNode content : output.path("content")) {
                if ("output_text".equals(content.path("type").asText()))
                    return Optional.of(mapper.readTree(content.path("text").asText()));
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        } catch (Exception ignored) { /* deterministic caller fallback; never log secrets or model text */ }
        return Optional.empty();
    }

    public static Map<String, Object> objectSchema(Map<String, Object> properties) {
        return Map.of("type", "object", "properties", properties, "required", properties.keySet().stream().toList(), "additionalProperties", false);
    }
}
