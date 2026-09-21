package com.xisnd.monitoring.llm;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.*;

final class LlmResponses {
    static final ObjectMapper JSON = new ObjectMapper().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
        .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    static final int MAX_REQUEST_BYTES = 512 * 1024;
    static void checkHttp(LlmTransport.Response response, boolean oauth) {
        if (response.status() == 200) return;
        switch (response.status()) {
            case 401 -> throw new LlmException(oauth ? LlmException.Code.LOCAL_AUTH_REQUIRED : LlmException.Code.API_AUTH_REJECTED);
            case 403 -> throw new LlmException(LlmException.Code.ACCESS_DENIED);
            case 429 -> throw new LlmException(LlmException.Code.RATE_LIMITED);
            case 404 -> throw new LlmException(LlmException.Code.MODEL_UNAVAILABLE);
            default -> { }
        }
        try {
            var failure = JSON.readTree(response.body()).path("error");
            LlmException.Code code = knownError(failure.path("code").asText());
            if (code != null) throw new LlmException(code);
        } catch (LlmException ex) { throw ex; }
        catch (Exception ignored) { }
        throw new LlmException(LlmException.Code.HTTP_ERROR);
    }
    private static LlmException.Code knownError(String code) {
        return switch (code) {
            case "rate_limit_exceeded", "insufficient_quota" -> LlmException.Code.RATE_LIMITED;
            case "model_not_found" -> LlmException.Code.MODEL_UNAVAILABLE;
            default -> null;
        };
    }
    private static LlmException failure(JsonNode error) {
        LlmException.Code code = knownError(error.path("code").asText());
        return new LlmException(code == null ? LlmException.Code.MODEL_FAILED : code);
    }
    static byte[] request(LlmSettings settings, String purpose, String instructions, Object input, Map<String, Object> schema, boolean stream) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", settings.model()); body.put("instructions", instructions);
            body.put("input", List.of(Map.of("role", "user", "content", List.of(Map.of("type", "input_text", "text", JSON.writeValueAsString(input))))));
            body.put("store", false); body.put("stream", stream); body.put("tools", List.of());
            body.put("tool_choice", stream ? "auto" : "none"); body.put("parallel_tool_calls", false); body.put("include", List.of());
            body.put("text", Map.of("format", Map.of("type", "json_schema", "name", purpose, "strict", true, "schema", schema)));
            if (!stream) body.put("max_output_tokens", 1800);
            byte[] encoded = JSON.writeValueAsBytes(body);
            if (encoded.length > MAX_REQUEST_BYTES) throw new LlmException(LlmException.Code.RESPONSE_TOO_LARGE);
            return encoded;
        } catch (LlmException ex) { throw ex; }
        catch (Exception ignored) { throw new LlmException(LlmException.Code.INVALID_RESPONSE); }
    }

    static JsonNode parse(LlmTransport.Response response, boolean sse, Map<String, Object> schema, LlmCancellation cancellation) {
        cancellation.check();
        if (response.body().length > JdkLlmTransport.MAX_RESPONSE_BYTES) throw new LlmException(LlmException.Code.RESPONSE_TOO_LARGE);
        String text;
        try { text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(response.body())).toString(); }
        catch (Exception ignored) { throw new LlmException(LlmException.Code.INVALID_RESPONSE); }
        String contentType = response.contentType().toLowerCase(Locale.ROOT);
        // Codex's official client parses SSE bytes regardless of the response MIME label.
        if (!sse && !contentType.startsWith("application/json"))
            throw new LlmException(LlmException.Code.INVALID_RESPONSE);
        JsonNode envelope = sse ? sse(text, cancellation) : json(text);
        JsonNode result = output(envelope);
        validate(result, JSON.valueToTree(schema), 0);
        cancellation.check();
        return result;
    }

    private static JsonNode sse(String text, LlmCancellation cancellation) {
        // The transport buffers bounded bytes, so decoding never splits a UTF-8 codepoint.
        // SSE frames are separated by an empty line; CRLF, CR and LF are all valid line endings.
        if (text.startsWith("\uFEFF")) text = text.substring(1);
        text = text.replace("\r\n", "\n").replace('\r', '\n');
        String[] lines = text.split("\n", -1);
        StringBuilder data = new StringBuilder();
        JsonNode completed = null;
        SortedMap<Integer, JsonNode> doneItems = new TreeMap<>();
        Map<Integer, String> addedIds = new HashMap<>();
        Set<String> addedItemIds = new HashSet<>();
        Set<String> doneIds = new HashSet<>();
        boolean ended = false;
        for (int index = 0; index < lines.length; index++) {
            if (index == lines.length - 1 && text.endsWith("\n")) break;
            cancellation.check();
            String line = lines[index];
            if (line.length() > 512 * 1024) throw new LlmException(LlmException.Code.RESPONSE_TOO_LARGE);
            if (line.isEmpty()) {
                if (data.length() == 0) continue;
                String payload = data.substring(0, data.length() - 1); data.setLength(0);
                if (payload.equals("[DONE]")) {
                    if (completed == null) throw new LlmException(LlmException.Code.INCOMPLETE_RESPONSE);
                    ended = true; continue;
                }
                if (ended) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
                JsonNode item = json(payload);
                String type = item.path("type").asText();
                if (!item.isObject() || type.isBlank()) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
                if (type.equals("error")) throw failure(item.has("error") ? item.path("error") : item);
                if (type.equals("response.failed")) throw failure(item.path("response").path("error"));
                if (type.equals("response.incomplete")) throw new LlmException(LlmException.Code.INCOMPLETE_RESPONSE);
                if (type.contains("refusal")) throw new LlmException(LlmException.Code.MODEL_REFUSAL);
                if (type.contains("_call") || type.contains("tool_search")) throw new LlmException(LlmException.Code.UNEXPECTED_OUTPUT);
                if (type.equals("response.output_item.added") || type.equals("response.output_item.done")) {
                    JsonNode outputItem = item.path("item");
                    checkItem(outputItem);
                    // Codex accepts items without index/id. Validate either when present, otherwise
                    // use the official client's completed-item arrival order.
                    int outputIndex = item.has("output_index") ? outputIndex(item) : doneItems.size();
                    String id = outputItem.path("id").asText();
                    if (outputItem.has("id") && (!outputItem.path("id").isTextual() || id.isBlank() || id.length() > 200))
                        throw new LlmException(LlmException.Code.INVALID_RESPONSE);
                    if (type.endsWith(".added")) {
                        if (!id.isEmpty() && !addedItemIds.add(id)
                            || item.has("output_index") && (addedIds.putIfAbsent(outputIndex, id) != null || doneItems.containsKey(outputIndex)))
                            throw new LlmException(LlmException.Code.INVALID_RESPONSE);
                    } else {
                        String addedId = addedIds.getOrDefault(outputIndex, "");
                        if (outputIndex != doneItems.size() || !addedId.isEmpty() && !id.isEmpty() && !addedId.equals(id)
                            || !id.isEmpty() && !doneIds.add(id))
                            throw new LlmException(LlmException.Code.INVALID_RESPONSE);
                        for (var entry : addedIds.entrySet())
                            if (!id.isEmpty() && entry.getValue().equals(id) && entry.getKey() != outputIndex)
                                throw new LlmException(LlmException.Code.INVALID_RESPONSE);
                        doneItems.put(outputIndex, outputItem);
                    }
                }
                if (type.equals("response.content_part.added") || type.equals("response.content_part.done")) checkPart(item.path("part"));
                if (type.equals("response.completed")) {
                    if (completed != null) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
                    completed = assemble(item.path("response"), doneItems, addedIds);
                }
                // Deltas are intentionally never accepted as a successful result.
            } else if (!line.startsWith(":")) {
                int colon = line.indexOf(':');
                String field = colon < 0 ? line : line.substring(0, colon);
                String value = colon < 0 ? "" : line.substring(colon + 1);
                if (value.startsWith(" ")) value = value.substring(1);
                if (field.equals("data")) data.append(value).append('\n');
            }
        }
        if (data.length() != 0 || completed == null) throw new LlmException(LlmException.Code.INCOMPLETE_RESPONSE);
        return completed;
    }

    private static int outputIndex(JsonNode event) {
        JsonNode index = event.path("output_index");
        if (!index.isIntegralNumber() || !index.canConvertToInt() || index.intValue() < 0 || index.intValue() > 10000)
            throw new LlmException(LlmException.Code.INVALID_RESPONSE);
        return index.intValue();
    }

    private static JsonNode assemble(JsonNode response, SortedMap<Integer, JsonNode> done, Map<Integer, String> added) {
        if (!response.isObject()) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
        var result = ((com.fasterxml.jackson.databind.node.ObjectNode) response).deepCopy();
        if (!result.has("status")) result.put("status", "completed");
        int expected = 0;
        var output = JSON.createArrayNode();
        for (var entry : done.entrySet()) {
            if (entry.getKey() != expected++) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
            output.add(entry.getValue());
        }
        if (!done.keySet().containsAll(added.keySet())) throw new LlmException(LlmException.Code.INCOMPLETE_RESPONSE);
        // Codex may omit or leave the aggregate output empty; completed items are
        // delivered separately. A nonempty aggregate is only a consistency check.
        if (result.hasNonNull("output") && !result.path("output").isArray()) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
        if (result.hasNonNull("output") && !result.path("output").isEmpty()) {
            if (!done.isEmpty() && !result.path("output").equals(output)) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
        } else result.set("output", output);
        return result;
    }

    private static JsonNode output(JsonNode response) {
        String status = response.path("status").asText();
        if (status.equals("failed") || response.hasNonNull("error")) throw failure(response.path("error"));
        if (!status.equals("completed") || response.hasNonNull("incomplete_details")) throw new LlmException(LlmException.Code.INCOMPLETE_RESPONSE);
        if (!response.path("output").isArray()) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
        StringBuilder text = new StringBuilder();
        for (JsonNode item : response.path("output")) {
            checkItem(item);
            if (item.path("type").asText().equals("reasoning")) continue;
            if (item.has("status") && !item.path("status").asText().equals("completed")) throw new LlmException(LlmException.Code.INCOMPLETE_RESPONSE);
            for (JsonNode part : item.path("content")) { checkPart(part); text.append(part.path("text").asText()); }
        }
        if (text.length() == 0) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
        return json(text.toString());
    }
    private static void checkItem(JsonNode item) {
        String type = item.path("type").asText();
        if (!type.equals("message") && !type.equals("reasoning")) throw new LlmException(LlmException.Code.UNEXPECTED_OUTPUT);
        if (type.equals("message") && item.has("role") && !item.path("role").asText().equals("assistant")) throw new LlmException(LlmException.Code.UNEXPECTED_OUTPUT);
        for (JsonNode part : item.path("content")) {
            if (type.equals("reasoning")) {
                String partType = part.path("type").asText();
                if (partType.equals("refusal")) throw new LlmException(LlmException.Code.MODEL_REFUSAL);
                // Pinned Codex ResponseItem::Reasoning contains ReasoningText or Text.
                // Validate their form but never include reasoning in the structured result.
                if ((!partType.equals("reasoning_text") && !partType.equals("text")) || !part.path("text").isTextual())
                    throw new LlmException(LlmException.Code.UNEXPECTED_OUTPUT);
            } else checkPart(part);
        }
    }
    private static void checkPart(JsonNode part) {
        String type = part.path("type").asText();
        if (type.equals("refusal")) throw new LlmException(LlmException.Code.MODEL_REFUSAL);
        if (!type.equals("output_text")) throw new LlmException(LlmException.Code.UNEXPECTED_OUTPUT);
    }
    static JsonNode json(String text) {
        try {
            JsonNode parsed = JSON.readTree(text);
            if (parsed == null || parsed.isMissingNode()) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
            return parsed;
        }
        catch (Exception ignored) { throw new LlmException(LlmException.Code.INVALID_RESPONSE); }
    }
    /** The small schema vocabulary actually used by the two application callers. */
    private static void validate(JsonNode node, JsonNode schema, int depth) {
        if (node == null || depth > 32) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
        String type = schema.path("type").asText();
        boolean valid = switch (type) {
            case "object" -> node.isObject(); case "array" -> node.isArray(); case "string" -> node.isTextual();
            case "boolean" -> node.isBoolean(); case "integer" -> node.isIntegralNumber(); case "number" -> node.isNumber();
            case "null" -> node.isNull(); default -> false;
        };
        if (!valid) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
        if (schema.has("enum")) {
            boolean found = false;
            for (JsonNode value : schema.path("enum")) if (value.equals(node)) found = true;
            if (!found) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
        }
        if (node.isObject()) {
            for (JsonNode required : schema.path("required")) if (!node.has(required.asText())) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
            var fields = node.fields();
            while (fields.hasNext()) {
                var field = fields.next();
                if (!schema.path("properties").has(field.getKey())) {
                    if (schema.path("additionalProperties").isBoolean() && !schema.path("additionalProperties").asBoolean()) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
                } else validate(field.getValue(), schema.path("properties").path(field.getKey()), depth + 1);
            }
        } else if (node.isArray()) {
            if (node.size() > 10000) throw new LlmException(LlmException.Code.RESPONSE_TOO_LARGE);
            for (JsonNode item : node) validate(item, schema.path("items"), depth + 1);
        }
    }
}
