package com.xisnd.monitoring.llm;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;

/** This application needs one synchronous structured response, without tools or conversation state. */
public interface StructuredLlm {
    JsonNode generate(String purpose, String instructions, Object input, Map<String, Object> schema, LlmCancellation cancellation);
    default JsonNode generate(String purpose, String instructions, Object input, Map<String, Object> schema) {
        return generate(purpose, instructions, input, schema, new LlmCancellation());
    }
    boolean authConfigured();
    static Map<String, Object> objectSchema(Map<String, Object> properties) {
        return Map.of("type", "object", "properties", properties, "required", properties.keySet().stream().toList(), "additionalProperties", false);
    }
}
