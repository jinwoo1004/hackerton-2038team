package com.xisnd.monitoring.llm;

import static org.assertj.core.api.Assertions.*;
import static com.xisnd.monitoring.llm.LlmProviderBoundaryTest.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.Test;

/** Protocol fixtures contain synthetic output only; no HTTP or credentials are used. */
class LlmSseCompletionTest {
    private static final String FINISH = event(Map.of("type", "response.completed", "response", Map.of("id", "resp-safe", "status", "completed")));

    @Test void done_items_are_assembled_only_after_completed_without_output() {
        String stream = event(Map.of("type", "response.output_text.delta", "delta", "ignored"))
            + done(0, message("item-safe", "{\"ok\":true}")) + FINISH;
        assertThat(parse(stream).path("ok").asBoolean()).isTrue();
        // The official Codex types do not require output_index or item.id.
        assertThat(parse(event(Map.of("type", "response.output_item.done", "item", message(null, "{\"ok\":true}")))
            + event(Map.of("type", "response.completed", "response", Map.of("id", "resp-safe")))).path("ok").asBoolean()).isTrue();
    }

    @Test void completed_output_is_verified_and_never_appended_twice() {
        var message = message("item-safe", "{\"ok\":true}");
        String finish = event(Map.of("type", "response.completed", "response", Map.of("status", "completed", "output", List.of(message))));
        assertThat(parse(done(0, message) + finish).path("ok").asBoolean()).isTrue();
        String conflicting = event(Map.of("type", "response.completed", "response", Map.of("status", "completed", "output", List.of(message("item-safe", "{\"ok\":false}")))));
        assertCode(() -> parse(done(0, message) + conflicting), LlmException.Code.INVALID_RESPONSE);
    }

    @Test void codex_completed_null_or_empty_output_uses_done_items_but_api_does_not() {
        for (String output : List.of("null", "[]")) {
            String envelope = "{\"status\":\"completed\",\"output\":" + output + "}";
            String finish = "data: {\"type\":\"response.completed\",\"response\":" + envelope + "}\n\n";
            assertThat(parse(done(0, message("item-safe", "{\"ok\":true}")) + finish).path("ok").asBoolean()).isTrue();
            assertCode(() -> parse(finish), LlmException.Code.INVALID_RESPONSE);
            assertCode(() -> LlmResponses.parse(jsonResponse(envelope), false, SCHEMA, new LlmCancellation()), LlmException.Code.INVALID_RESPONSE);
        }
        for (String output : List.of("{}", "true", "\"invalid\"")) {
            String finish = "data: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"output\":" + output + "}}\n\n";
            assertCode(() -> parse(done(0, message("item-safe", "{\"ok\":true}")) + finish), LlmException.Code.INVALID_RESPONSE);
        }
    }

    @Test void multiple_done_items_preserve_order_and_reject_duplicates_gaps_and_id_mismatch() {
        Map<String, Object> reasoning = Map.of("type", "reasoning", "id", "reason-safe", "summary", List.of());
        var message = message("item-safe", "{\"ok\":true}");
        assertThat(parse(done(0, reasoning) + done(1, message) + FINISH).path("ok").asBoolean()).isTrue();
        for (String invalid : List.of(done(1, message), done(0, message) + done(0, message),
            done(0, message) + done(1, message), done(-1, message), done(0, message) + done(2, reasoning),
            event(Map.of("type", "response.output_item.done", "output_index", "0", "item", message))))
            assertCode(() -> parse(invalid + FINISH), LlmException.Code.INVALID_RESPONSE);
        String added = event(Map.of("type", "response.output_item.added", "output_index", 0, "item", message("expected", "")));
        assertCode(() -> parse(added + done(0, message) + FINISH), LlmException.Code.INVALID_RESPONSE);
        assertCode(() -> parse(added + FINISH), LlmException.Code.INCOMPLETE_RESPONSE);
    }

    @Test void official_reasoning_content_is_validated_but_never_used_as_structured_output() {
        for (String contentType : List.of("reasoning_text", "text")) {
            Map<String, Object> reasoning = Map.of("type", "reasoning", "summary", List.of(), "content", List.of(Map.of("type", contentType, "text", "synthetic non-result text")));
            assertThat(parse(done(0, reasoning) + done(1, message(null, "{\"ok\":true}")) + FINISH).path("ok").asBoolean()).isTrue();
            assertCode(() -> parse(done(0, reasoning) + FINISH), LlmException.Code.INVALID_RESPONSE);
        }
        var invalid = Map.<String, Object>of("type", "reasoning", "content", List.of(Map.of("type", "function_call", "text", "ignored")));
        assertCode(() -> parse(done(0, invalid) + FINISH), LlmException.Code.UNEXPECTED_OUTPUT);
    }

    @Test void done_items_with_failure_incomplete_or_eof_never_return_partial_success() {
        String prefix = done(0, message("item-safe", "{\"ok\":true}"));
        assertCode(() -> parse(prefix), LlmException.Code.INCOMPLETE_RESPONSE);
        assertCode(() -> parse(prefix + event(Map.of("type", "response.failed", "response", Map.of("error", Map.of("code", "rate_limit_exceeded"))))), LlmException.Code.RATE_LIMITED);
        assertCode(() -> parse(prefix + event(Map.of("type", "response.incomplete"))), LlmException.Code.INCOMPLETE_RESPONSE);
        assertCode(() -> parse(prefix + event(Map.of("type", "error"))), LlmException.Code.MODEL_FAILED);
    }

    @Test void codex_uses_json_event_type_and_body_structure_while_api_still_requires_json_mime() {
        String stream = "event: message\n" + done(0, message("item-safe", "{\"ok\":true}")) + FINISH;
        for (String mime : List.of("", "application/octet-stream", "text/plain")) {
            var response = new LlmTransport.Response(200, mime, stream.getBytes(StandardCharsets.UTF_8));
            assertThat(LlmResponses.parse(response, true, SCHEMA, new LlmCancellation()).path("ok").asBoolean()).isTrue();
            assertCode(() -> LlmResponses.parse(new LlmTransport.Response(200, mime, envelope("{\"ok\":true}").getBytes(StandardCharsets.UTF_8)), false, SCHEMA, new LlmCancellation()), LlmException.Code.INVALID_RESPONSE);
        }
        assertCode(() -> parse("data: {}\n\n" + FINISH), LlmException.Code.INVALID_RESPONSE);
        assertCode(() -> parse("{\"ok\":true}"), LlmException.Code.INCOMPLETE_RESPONSE);
    }

    private static com.fasterxml.jackson.databind.JsonNode parse(String stream) { return LlmResponses.parse(sse(stream), true, SCHEMA, new LlmCancellation()); }
    private static Map<String, Object> message(String id, String content) {
        var item = new LinkedHashMap<String, Object>();
        item.put("type", "message"); item.put("role", "assistant"); item.put("status", "completed");
        if (id != null) item.put("id", id);
        item.put("content", List.of(Map.of("type", "output_text", "text", content)));
        return item;
    }
    private static String done(int index, Map<String, Object> item) { return event(Map.of("type", "response.output_item.done", "output_index", index, "item", item)); }
    private static String event(Map<String, Object> event) {
        try { return "data: " + LlmResponses.JSON.writeValueAsString(event) + "\n\n"; }
        catch (Exception e) { throw new AssertionError(e); }
    }
}
