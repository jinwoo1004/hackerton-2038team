package com.xisnd.monitoring.llm;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;

/** Test-only deterministic adapter. Application fixtures must opt in; no model or credentials are read. */
public final class MockLlmProvider implements StructuredLlm {
    @Override public boolean authConfigured() { return false; }
    @Override public JsonNode generate(String purpose, String instructions, Object input, Map<String, Object> schema, LlmCancellation cancellation) {
        cancellation.check();
        if (purpose.equals("developer_smoke")) return LlmResponses.json("{\"ok\":true}");
        throw new LlmException(LlmException.Code.MOCK_UNAVAILABLE);
    }
}
