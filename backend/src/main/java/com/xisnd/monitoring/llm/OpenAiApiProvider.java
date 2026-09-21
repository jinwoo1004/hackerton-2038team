package com.xisnd.monitoring.llm;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.Map;

/** Deployed API credentials only. This adapter has no auth-file dependency. */
public final class OpenAiApiProvider implements StructuredLlm {
    public static final URI ENDPOINT = URI.create("https://api.openai.com/v1/responses");
    private final LlmSettings settings;
    private final LlmTransport transport;
    OpenAiApiProvider(LlmSettings settings, LlmTransport transport) {
        if (!settings.runtime().equals("deployed") || !settings.provider().equals("openai_api")) throw new LlmException(LlmException.Code.CONFIG_INVALID);
        this.settings = settings; this.transport = transport;
    }
    @Override public boolean authConfigured() { return settings.apiKey() != null; }
    @Override public JsonNode generate(String purpose, String instructions, Object input, Map<String, Object> schema, LlmCancellation cancellation) {
        cancellation.check();
        byte[] body = LlmResponses.request(settings, purpose, instructions, input, schema, false);
        var request = new LlmTransport.Request(ENDPOINT, Map.of("Authorization", "Bearer " + settings.apiKey(),
            "User-Agent", "monitoring-platform/1.0", "Content-Type", "application/json", "Accept", "application/json"), body);
        LlmTransport.Response response = transport.exchange(request, settings.timeout(), cancellation);
        LlmResponses.checkHttp(response, false);
        return LlmResponses.parse(response, false, schema, cancellation);
    }
    @Override public String toString() { return "OpenAiApiProvider[redacted]"; }
}
