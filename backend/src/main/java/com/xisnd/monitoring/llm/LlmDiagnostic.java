package com.xisnd.monitoring.llm;

import java.io.PrintStream;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;

/** Standalone: does not boot Spring, load the database, or log prompts/credentials/provider responses. */
public final class LlmDiagnostic {
    private LlmDiagnostic() {}
    public static void main(String[] args) {
        int status = run(args, System::getenv, LlmFactory.repositoryRoot(), new JdkLlmTransport(), System.out);
        if (status != 0) System.exit(status);
    }
    static int run(String[] args, Function<String, String> env, Path root, LlmTransport transport, PrintStream out) {
        Map<String, Object> safe = new LinkedHashMap<>();
        int exit = 0;
        try {
            if (args.length != 1 || !java.util.Set.of("diagnose", "smoke").contains(args[0])) throw new LlmException(LlmException.Code.CONFIG_INVALID);
            LlmSettings settings = LlmSettings.load(env, root);
            safe.put("runtime", settings.runtime()); safe.put("provider", settings.provider()); safe.put("model", settings.model());
            safe.put("authConfigured", false);
            StructuredLlm provider = LlmFactory.create(settings, transport);
            safe.put("authConfigured", provider.authConfigured());
            if (args[0].equals("smoke")) {
                var response = provider.generate("developer_smoke", "Return the requested JSON object with ok set to true.", Map.of("check", "ok"),
                    StructuredLlm.objectSchema(Map.of("ok", Map.of("type", "boolean"))));
                if (!response.path("ok").asBoolean()) throw new LlmException(LlmException.Code.INVALID_RESPONSE);
            }
        } catch (LlmException error) {
            exit = error.code().exitCode(); safe.put("code", error.code().name()); safe.put("message", error.getMessage());
        } catch (Exception ignored) {
            exit = 4; safe.put("code", "INTERNAL_ERROR"); safe.put("message", "AI 진단을 완료하지 못했습니다.");
        }
        // Keep this process boundary ASCII-only; shell/Gradle code pages vary on Windows.
        // JSON consumers restore the original Korean safe messages from Unicode escapes.
        try { out.println(LlmResponses.JSON.writer().with(com.fasterxml.jackson.core.json.JsonWriteFeature.ESCAPE_NON_ASCII.mappedFeature()).writeValueAsString(safe)); }
        catch (Exception ignored) { out.println("{\"code\":\"INTERNAL_ERROR\"}"); return 4; }
        return exit;
    }
}
