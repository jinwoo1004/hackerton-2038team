package com.xisnd.monitoring.llm;

import java.nio.file.Path;
import java.time.Duration;
import java.util.function.Function;

/** Validates the selector before looking at any provider-specific configuration. */
public final class LlmSettings {
    private final String runtime, provider, model;
    private final Path authFile, repositoryRoot;
    private final String apiKey;
    private final Duration timeout;
    private LlmSettings(String runtime, String provider, String model, Path authFile, Path root, String apiKey, Duration timeout) {
        this.runtime = runtime; this.provider = provider; this.model = model; this.authFile = authFile;
        this.repositoryRoot = root; this.apiKey = apiKey; this.timeout = timeout;
    }
    public static LlmSettings load(Function<String, String> env, Path repositoryRoot) {
        String runtime = env.apply("APP_RUNTIME"), provider = env.apply("LLM_PROVIDER");
        if (!("local".equals(runtime) && "codex_oauth".equals(provider))
            && !("deployed".equals(runtime) && "openai_api".equals(provider))
            && !("test".equals(runtime) && "mock".equals(provider))) throw new LlmException(LlmException.Code.CONFIG_INVALID);
        Duration timeout = timeout(env.apply("LLM_TIMEOUT_SECONDS"));
        if (runtime.equals("test")) return new LlmSettings(runtime, provider, "mock-structured", null, null, null, timeout);
        String model = env.apply(runtime.equals("local") ? "CODEX_MODEL" : "OPENAI_MODEL");
        if (model == null || !model.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,119}")) throw new LlmException(LlmException.Code.MODEL_REQUIRED);
        if (runtime.equals("deployed")) {
            String key = env.apply("OPENAI_API_KEY");
            if (key == null || key.isBlank() || !key.matches("[\\x21-\\x7e]{1,8192}")) throw new LlmException(LlmException.Code.API_KEY_REQUIRED);
            return new LlmSettings(runtime, provider, model, null, null, key, timeout);
        }
        try {
            String configured = env.apply("CODEX_AUTH_FILE");
            if (configured == null || configured.isBlank()) throw new LlmException(LlmException.Code.AUTH_FILE_LOCATION);
            Path path = Path.of(configured).normalize(), root = repositoryRoot.toAbsolutePath().normalize();
            if (!path.isAbsolute() || path.startsWith(root) || path.startsWith(defaultCodexHome())) throw new LlmException(LlmException.Code.AUTH_FILE_LOCATION);
            return new LlmSettings(runtime, provider, model, path, root, null, timeout);
        } catch (LlmException e) { throw e; }
        catch (RuntimeException ignored) { throw new LlmException(LlmException.Code.AUTH_FILE_LOCATION); }
    }
    private static Duration timeout(String value) {
        if (value == null || value.isEmpty()) return Duration.ofSeconds(4);
        try {
            int seconds = Integer.parseInt(value);
            if (seconds < 1 || seconds > 60) throw new NumberFormatException();
            return Duration.ofSeconds(seconds);
        } catch (NumberFormatException ignored) { throw new LlmException(LlmException.Code.CONFIG_INVALID); }
    }
    public String runtime() { return runtime; }
    public String provider() { return provider; }
    public String model() { return model; }
    public Duration timeout() { return timeout; }
    Path authFile() { return authFile; }
    Path repositoryRoot() { return repositoryRoot; }
    String apiKey() { return apiKey; }
    static Path defaultCodexHome() { return Path.of(System.getProperty("user.home"), ".codex").toAbsolutePath().normalize(); }
    @Override public String toString() { return "LlmSettings[redacted]"; }
}
