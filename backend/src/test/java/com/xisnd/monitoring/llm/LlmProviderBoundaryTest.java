package com.xisnd.monitoring.llm;

import static org.assertj.core.api.Assertions.*;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class LlmProviderBoundaryTest {
    @TempDir Path temporary;
    static final Map<String, Object> SCHEMA = StructuredLlm.objectSchema(Map.of("ok", Map.of("type", "boolean")));

    @ParameterizedTest
    @CsvSource({"local,openai_api", "local,mock", "deployed,codex_oauth", "deployed,mock", "test,codex_oauth", "test,openai_api", "LOCAL,codex_oauth", "local,codex_oaut", "production,openai_api"})
    void invalid_selector_fails_before_credentials_or_transport(String runtime, String provider) {
        List<String> visited = new ArrayList<>();
        assertCode(() -> LlmSettings.load(name -> {
            visited.add(name);
            return name.equals("APP_RUNTIME") ? runtime : name.equals("LLM_PROVIDER") ? provider : fail("Credential lookup before validation");
        }, temporary), LlmException.Code.CONFIG_INVALID);
        assertThat(visited).containsExactly("APP_RUNTIME", "LLM_PROVIDER");
    }

    @Test void missing_selector_never_infers_from_key_model_or_hostname() {
        for (Map<String, String> env : List.of(Map.of("OPENAI_API_KEY", "synthetic-key"), Map.of("APP_RUNTIME", "local"), Map.of("LLM_PROVIDER", "codex_oauth")))
            assertCode(() -> LlmSettings.load(env::get, temporary), LlmException.Code.CONFIG_INVALID);
    }

    @Test void local_never_reads_incidental_api_key_and_uses_verified_oauth_contract() throws Exception {
        Path root = Files.createDirectory(temporary.resolve("repo")), auth = temporary.resolve("auth.json");
        writeAuth(auth, "account-one", Instant.now().plusSeconds(3600).getEpochSecond());
        Map<String, String> env = local(auth);
        env.put("OPENAI_API_KEY", "must-not-read"); env.put("app.llm.runtime", "deployed"); env.put("app.llm.provider", "openai_api");
        var settings = LlmSettings.load(name -> { if (name.startsWith("OPENAI_")) fail("Local read API settings"); return env.get(name); }, root);
        assertThat(settings.runtime()).isEqualTo("local");
        AtomicReference<LlmTransport.Request> captured = new AtomicReference<>();
        var provider = LlmFactory.create(settings, (request, timeout, cancellation) -> { captured.set(request); return sse(completed("{\"ok\":true}")); });
        assertThat(provider.generate("contract", "instructions", Map.of("safe", true), SCHEMA).path("ok").asBoolean()).isTrue();
        var request = captured.get();
        assertThat(request.uri()).isEqualTo(CodexOAuthProvider.ENDPOINT);
        assertThat(request.headers().keySet()).containsExactlyInAnyOrder("Authorization", "ChatGPT-Account-ID", "Content-Type", "Accept", "User-Agent");
        assertThat(request.headers().get("User-Agent")).isEqualTo("monitoring-platform/1.0");
        var body = LlmResponses.JSON.readTree(request.body());
        assertThat(body.path("model").asText()).isEqualTo("test-model");
        assertThat(body.path("stream").asBoolean()).isTrue();
        assertThat(body.path("store").asBoolean()).isFalse();
        assertThat(body.has("max_output_tokens")).isFalse();
        assertThat(body.path("tools").isEmpty()).isTrue();
        assertThat(body.path("tool_choice").asText()).isEqualTo("auto");
        assertThat(body.path("parallel_tool_calls").asBoolean()).isFalse();
        assertThat(body.path("include").isEmpty()).isTrue();
        assertThat(body.path("input").get(0).path("role").asText()).isEqualTo("user");
        assertThat(body.path("input").get(0).path("content").get(0).path("type").asText()).isEqualTo("input_text");
        assertThat(body.path("text").path("format").path("strict").asBoolean()).isTrue();
        assertThat(request.toString()).isEqualTo("LlmRequest[redacted]");
    }

    @Test void deployed_does_not_even_lookup_oauth_path_and_requires_api_key() throws Exception {
        var env = new HashMap<>(Map.of("APP_RUNTIME", "deployed", "LLM_PROVIDER", "openai_api", "OPENAI_MODEL", "test-api-model", "OPENAI_API_KEY", "synthetic-api-key"));
        var settings = LlmSettings.load(name -> { if (name.startsWith("CODEX_")) fail("Deployment looked up OAuth"); return env.get(name); }, null);
        AtomicReference<LlmTransport.Request> request = new AtomicReference<>();
        var provider = LlmFactory.create(settings, (r, timeout, cancellation) -> { request.set(r); return jsonResponse(envelope("{\"ok\":true}")); });
        assertThat(provider.authConfigured()).isTrue();
        provider.generate("contract", "instructions", Map.of(), SCHEMA);
        assertThat(request.get().uri()).isEqualTo(OpenAiApiProvider.ENDPOINT);
        assertThat(request.get().headers()).doesNotContainKey("ChatGPT-Account-ID");
        var body = LlmResponses.JSON.readTree(request.get().body());
        assertThat(body.path("max_output_tokens").asInt()).isEqualTo(1800);
        assertThat(body.path("stream").asBoolean()).isFalse();
        assertThat(body.path("tool_choice").asText()).isEqualTo("none");
        env.remove("OPENAI_API_KEY");
        assertCode(() -> LlmSettings.load(name -> { if (name.startsWith("CODEX_")) fail("Fallback lookup"); return env.get(name); }, null), LlmException.Code.API_KEY_REQUIRED);
    }

    @Test void model_is_required_only_for_selected_real_provider() throws Exception {
        var local = local(temporary.resolve("auth.json")); local.remove("CODEX_MODEL");
        assertCode(() -> LlmSettings.load(local::get, temporary.resolve("repo")), LlmException.Code.MODEL_REQUIRED);
        assertCode(() -> LlmSettings.load(Map.of("APP_RUNTIME", "deployed", "LLM_PROVIDER", "openai_api", "OPENAI_API_KEY", "unused")::get, temporary), LlmException.Code.MODEL_REQUIRED);
        var settings = LlmSettings.load(name -> switch (name) {
            case "APP_RUNTIME" -> "test"; case "LLM_PROVIDER" -> "mock"; case "LLM_TIMEOUT_SECONDS" -> null;
            default -> fail("Mock read model/credential settings");
        }, null);
        var provider = LlmFactory.create(settings, (r, t, c) -> fail("Mock performed network"));
        assertThat(provider.generate("developer_smoke", "", Map.of(), SCHEMA).path("ok").asBoolean()).isTrue();
    }

    @Test void auth_file_location_rejects_relative_repo_and_default_store() {
        for (Path auth : List.of(Path.of("relative/auth.json"), temporary.resolve("auth.json"), LlmSettings.defaultCodexHome().resolve("auth.json")))
            assertCode(() -> LlmSettings.load(local(auth)::get, temporary), LlmException.Code.AUTH_FILE_LOCATION);
    }

    @Test void auth_hot_reload_expiry_malformed_and_missing_never_use_network() throws Exception {
        Path root = Files.createDirectory(temporary.resolve("repo")), auth = temporary.resolve("auth.json");
        AtomicInteger calls = new AtomicInteger(); List<String> accounts = new ArrayList<>();
        var provider = LlmFactory.create(LlmSettings.load(local(auth)::get, root), (r, t, c) -> { calls.incrementAndGet(); accounts.add(r.headers().get("ChatGPT-Account-ID")); return sse(completed("{\"ok\":true}")); });
        assertCode(provider::authConfigured, LlmException.Code.LOCAL_AUTH_REQUIRED);
        writeAuth(auth, "first-account", Instant.now().plusSeconds(1000).getEpochSecond());
        assertThat(provider.authConfigured()).isTrue(); assertThat(calls.get()).isZero();
        provider.generate("contract", "", Map.of(), SCHEMA);
        writeAuth(auth, "second-account", Instant.now().plusSeconds(2000).getEpochSecond());
        provider.generate("contract", "", Map.of(), SCHEMA);
        assertThat(accounts).containsExactly("first-account", "second-account");
        writeAuth(auth, "expired", Instant.now().minusSeconds(10).getEpochSecond());
        assertCode(() -> provider.generate("contract", "", Map.of(), SCHEMA), LlmException.Code.LOCAL_AUTH_REQUIRED);
        for (String invalid : List.of("not-json", "{}", "{\"auth_mode\":\"apikey\",\"OPENAI_API_KEY\":\"synthetic-secret\"}", "{\"auth_mode\":\"chatgpt\",\"tokens\":{\"access_token\":\"bad\",\"account_id\":\"account\"}}")) {
            Files.writeString(auth, invalid);
            assertCode(() -> provider.generate("contract", "", Map.of(), SCHEMA), LlmException.Code.LOCAL_AUTH_REQUIRED);
        }
        Files.delete(auth);
        assertCode(() -> provider.generate("contract", "", Map.of(), SCHEMA), LlmException.Code.LOCAL_AUTH_REQUIRED);
        assertThat(calls.get()).isEqualTo(2);
    }

    @Test void auth_rejects_repository_alias_and_intermediate_junction_that_exits_repository() throws Exception {
        Path root = Files.createDirectory(temporary.resolve("repo"));
        Path outside = Files.createDirectory(temporary.resolve("private"));
        Path alias = temporary.resolve("alias"), escape = root.resolve("escape");
        writeAuth(root.resolve("auth.json"), "inside", Instant.now().plusSeconds(1000).getEpochSecond());
        writeAuth(outside.resolve("auth.json"), "outside", Instant.now().plusSeconds(1000).getEpochSecond());
        try {
            directoryLink(alias, root); directoryLink(escape, outside);
            for (Path file : List.of(alias.resolve("auth.json"), alias.resolve("escape/auth.json"))) {
                var provider = LlmFactory.create(LlmSettings.load(local(file)::get, root), (r,t,c) -> fail("Junction credential reached network"));
                assertCode(provider::authConfigured, LlmException.Code.LOCAL_AUTH_REQUIRED);
            }
        } finally {
            // Remove the links themselves, never recursively delete their destinations.
            Files.deleteIfExists(escape); Files.deleteIfExists(alias);
        }
    }

    @ParameterizedTest @CsvSource({"401,LOCAL_AUTH_REQUIRED", "403,ACCESS_DENIED", "429,RATE_LIMITED", "404,MODEL_UNAVAILABLE", "500,HTTP_ERROR"})
    void oauth_http_failures_make_zero_paid_requests(int status, LlmException.Code code) throws Exception {
        Path root = Files.createDirectory(temporary.resolve("repo")), auth = temporary.resolve("auth.json");
        writeAuth(auth, "account", Instant.now().plusSeconds(1000).getEpochSecond());
        AtomicInteger oauth = new AtomicInteger(), paid = new AtomicInteger();
        var provider = LlmFactory.create(LlmSettings.load(name -> { if (name.startsWith("OPENAI_")) fail("Paid credential lookup"); return local(auth).get(name); }, root), (r, t, c) -> {
            if (r.uri().equals(OpenAiApiProvider.ENDPOINT)) paid.incrementAndGet(); else oauth.incrementAndGet();
            return new LlmTransport.Response(status, "application/json", "{\"message\":\"synthetic-sensitive-body\"}".getBytes(StandardCharsets.UTF_8));
        });
        assertCode(() -> provider.generate("contract", "", Map.of(), SCHEMA), code);
        assertThat(oauth.get()).isEqualTo(1); assertThat(paid.get()).isZero();
    }

    @Test void timeout_is_typed_and_does_not_retry_another_provider() throws Exception {
        Path root = Files.createDirectory(temporary.resolve("repo")), auth = temporary.resolve("auth.json");
        writeAuth(auth, "account", Instant.now().plusSeconds(1000).getEpochSecond());
        AtomicInteger calls = new AtomicInteger();
        var provider = LlmFactory.create(LlmSettings.load(local(auth)::get, root), (r, t, c) -> { calls.incrementAndGet(); assertThat(r.uri()).isEqualTo(CodexOAuthProvider.ENDPOINT); throw new LlmException(LlmException.Code.TIMEOUT); });
        assertCode(() -> provider.generate("contract", "", Map.of(), SCHEMA), LlmException.Code.TIMEOUT);
        assertThat(calls.get()).isEqualTo(1);
    }

    @Test void sse_handles_crlf_comments_multiline_data_and_authoritative_completed_output() {
        String response = envelope("{\"ok\":true}");
        String stream = ": keepalive\r\nevent: response.output_text.delta\r\ndata: {\"type\":\"response.output_text.delta\",\"delta\":\"partial ignored\"}\r\n\r\n"
            + "event: response.completed\r\ndata: {\"type\":\"response.completed\",\r\ndata: \"response\":" + response + "}\r\n\r\ndata: [DONE]\r\n\r\n";
        assertThat(LlmResponses.parse(sse(stream), true, SCHEMA, new LlmCancellation()).path("ok").asBoolean()).isTrue();
    }

    @ParameterizedTest @ValueSource(strings = {"", "\n", "\r", "\r\n"})
    void completed_event_without_blank_boundary_is_premature_eof(String terminator) {
        String data = completed("{\"ok\":true}").stripTrailing();
        assertCode(() -> LlmResponses.parse(sse(data + terminator), true, SCHEMA, new LlmCancellation()), LlmException.Code.INCOMPLETE_RESPONSE);
    }

    @Test void delta_followed_by_failure_incomplete_error_or_eof_is_never_success() {
        String delta = "data: {\"type\":\"response.output_text.delta\",\"delta\":\"{\\\"ok\\\":true}\"}\n\n";
        for (String type : List.of("response.failed", "response.incomplete", "error")) {
            String failure = "data: {\"type\":\"" + type + "\",\"message\":\"do not log body\"}\n\n";
            assertThatThrownBy(() -> LlmResponses.parse(sse(delta + failure), true, SCHEMA, new LlmCancellation())).isInstanceOf(LlmException.class);
            assertThatThrownBy(() -> LlmResponses.parse(sse(completed("{\"ok\":true}") + failure), true, SCHEMA, new LlmCancellation())).isInstanceOf(LlmException.class);
        }
        assertCode(() -> LlmResponses.parse(sse(delta), true, SCHEMA, new LlmCancellation()), LlmException.Code.INCOMPLETE_RESPONSE);
        assertCode(() -> LlmResponses.parse(sse("data: {\"type\":\"error\",\"code\":\"rate_limit_exceeded\"}\n\n"), true, SCHEMA, new LlmCancellation()), LlmException.Code.RATE_LIMITED);
        assertCode(() -> LlmResponses.parse(sse("data: {\"type\":\"response.failed\",\"response\":{\"error\":{\"code\":\"model_not_found\"}}}\n\n"), true, SCHEMA, new LlmCancellation()), LlmException.Code.MODEL_UNAVAILABLE);
    }

    @Test void tools_refusals_invalid_schema_duplicate_json_and_invalid_utf8_are_rejected() {
        for (String empty : List.of("", "   ", "\n\t"))
            assertCode(() -> LlmResponses.parse(jsonResponse(empty), false, SCHEMA, new LlmCancellation()), LlmException.Code.INVALID_RESPONSE);
        assertCode(() -> LlmResponses.parse(sse("data: \n\n"), true, SCHEMA, new LlmCancellation()), LlmException.Code.INVALID_RESPONSE);
        for (String type : List.of("function_call", "web_search_call", "computer_call"))
            assertCode(() -> LlmResponses.parse(sse("data: {\"type\":\"response.output_item.added\",\"item\":{\"type\":\"" + type + "\"}}\n\n" + completed("{\"ok\":true}")), true, SCHEMA, new LlmCancellation()), LlmException.Code.UNEXPECTED_OUTPUT);
        assertCode(() -> LlmResponses.parse(sse("data: {\"type\":\"response.refusal.delta\"}\n\n"), true, SCHEMA, new LlmCancellation()), LlmException.Code.MODEL_REFUSAL);
        for (String invalid : List.of("{\"ok\":\"wrong\"}", "{\"ok\":true,\"extra\":true}", "{\"ok\":true,\"ok\":false}", "{\"ok\":true} {}"))
            assertCode(() -> LlmResponses.parse(sse(completed(invalid)), true, SCHEMA, new LlmCancellation()), LlmException.Code.INVALID_RESPONSE);
        assertCode(() -> LlmResponses.parse(new LlmTransport.Response(200, "text/event-stream", new byte[]{(byte)0xc3, 0x28}), true, SCHEMA, new LlmCancellation()), LlmException.Code.INVALID_RESPONSE);
    }

    @Test void diagnostic_is_network_free_and_outputs_only_safe_metadata() throws Exception {
        Path root = Files.createDirectory(temporary.resolve("repo")), auth = temporary.resolve("auth.json");
        writeAuth(auth, "account", Instant.now().plusSeconds(1000).getEpochSecond());
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        int exit = LlmDiagnostic.run(new String[]{"diagnose"}, local(auth)::get, root, (r,t,c) -> fail("Diagnostic network"), new PrintStream(output, true, StandardCharsets.UTF_8));
        assertThat(exit).isZero();
        var json = LlmResponses.JSON.readTree(output.toByteArray());
        assertThat(json.size()).isEqualTo(4); assertThat(json.path("authConfigured").asBoolean()).isTrue();
        assertThat(output.toString(StandardCharsets.UTF_8)).doesNotContain(auth.toString(), "access_token", "account_id", "Bearer");
        Files.writeString(auth, "bad credential contents"); output.reset();
        assertThat(LlmDiagnostic.run(new String[]{"diagnose"}, local(auth)::get, root, (r,t,c) -> fail("Diagnostic network"), new PrintStream(output, true, StandardCharsets.UTF_8))).isEqualTo(3);
        String wireJson = output.toString(StandardCharsets.UTF_8);
        assertThat(wireJson).contains("LOCAL_AUTH_REQUIRED").doesNotContain("bad credential", auth.toString());
        assertThat(wireJson.chars().allMatch(character -> character < 128)).isTrue();
        assertThat(LlmResponses.JSON.readTree(wireJson).path("message").asText()).isEqualTo(LlmException.Code.LOCAL_AUTH_REQUIRED.safeMessage());
    }

    private Map<String, String> local(Path auth) { return new HashMap<>(Map.of("APP_RUNTIME", "local", "LLM_PROVIDER", "codex_oauth", "CODEX_MODEL", "test-model", "CODEX_AUTH_FILE", auth.toString())); }
    private void directoryLink(Path link, Path target) throws Exception {
        if (System.getProperty("os.name").startsWith("Windows")) {
            Process process = new ProcessBuilder("cmd", "/c", "mklink", "/J", link.toString(), target.toString()).redirectErrorStream(true).start();
            process.getInputStream().readAllBytes();
            assertThat(process.waitFor()).as("temporary junction creation").isZero();
        } else Files.createSymbolicLink(link, target);
    }
    private void writeAuth(Path path, String account, long expiration) throws Exception {
        String header = Base64.getUrlEncoder().withoutPadding().encodeToString("{\"alg\":\"RS256\"}".getBytes(StandardCharsets.UTF_8));
        String payload = Base64.getUrlEncoder().withoutPadding().encodeToString(("{\"exp\":" + expiration + "}").getBytes(StandardCharsets.UTF_8));
        Files.writeString(path, LlmResponses.JSON.writeValueAsString(Map.of("auth_mode", "chatgpt", "tokens", Map.of("access_token", header + "." + payload + ".testsignature", "account_id", account))));
    }
    static String envelope(String content) {
        try { return LlmResponses.JSON.writeValueAsString(Map.of("status", "completed", "output", List.of(Map.of("type", "message", "role", "assistant", "status", "completed", "content", List.of(Map.of("type", "output_text", "text", content)))))); }
        catch (Exception e) { throw new AssertionError(e); }
    }
    static String completed(String json) { return "data: {\"type\":\"response.completed\",\"response\":" + envelope(json) + "}\n\n"; }
    static LlmTransport.Response sse(String body) { return new LlmTransport.Response(200, "text/event-stream; charset=utf-8", body.getBytes(StandardCharsets.UTF_8)); }
    static LlmTransport.Response jsonResponse(String body) { return new LlmTransport.Response(200, "application/json", body.getBytes(StandardCharsets.UTF_8)); }
    static void assertCode(org.assertj.core.api.ThrowableAssert.ThrowingCallable action, LlmException.Code code) {
        assertThatThrownBy(action).isInstanceOfSatisfying(LlmException.class, error -> {
            assertThat(error.code()).isEqualTo(code); assertThat(error.getMessage()).isEqualTo(code.safeMessage()); assertThat(error.getCause()).isNull();
        });
    }
}
