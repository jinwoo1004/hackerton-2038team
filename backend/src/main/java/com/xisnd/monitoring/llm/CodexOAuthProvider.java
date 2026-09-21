package com.xisnd.monitoring.llm;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.Map;

/** ChatGPT OAuth only. Never resolves an API key and never switches to the paid API. */
public final class CodexOAuthProvider implements StructuredLlm {
    public static final URI ENDPOINT = URI.create("https://chatgpt.com/backend-api/codex/responses");
    private final LlmSettings settings;
    private final CodexAuthFile auth;
    private final LlmTransport transport;
    CodexOAuthProvider(LlmSettings settings, CodexAuthFile auth, LlmTransport transport) {
        if (!settings.runtime().equals("local") || !settings.provider().equals("codex_oauth")) throw new LlmException(LlmException.Code.CONFIG_INVALID);
        this.settings = settings; this.auth = auth; this.transport = transport;
    }
    @Override public boolean authConfigured() { auth.read(); return true; }
    @Override public JsonNode generate(String purpose, String instructions, Object input, Map<String, Object> schema, LlmCancellation cancellation) {
        cancellation.check();
        var credentials = auth.read(); // Re-read on every request; login replacement takes effect without restart.
        byte[] body = LlmResponses.request(settings, purpose, instructions, input, schema, true);
        var request = new LlmTransport.Request(ENDPOINT, Map.of("Authorization", "Bearer " + credentials.accessToken(),
            "ChatGPT-Account-ID", credentials.accountId(), "User-Agent", "monitoring-platform/1.0",
            "Content-Type", "application/json", "Accept", "text/event-stream"), body);
        LlmTransport.Response response = transport.exchange(request, settings.timeout(), cancellation);
        LlmResponses.checkHttp(response, true);
        return LlmResponses.parse(response, true, schema, cancellation);
    }
    @Override public String toString() { return "CodexOAuthProvider[redacted]"; }
}
