package com.xisnd.monitoring.llm;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;

public final class LlmFactory {
    private LlmFactory() {}
    public static StructuredLlm create(LlmSettings settings, LlmTransport transport) {
        return switch (settings.provider()) {
            case "codex_oauth" -> new CodexOAuthProvider(settings, new CodexAuthFile(settings.authFile(), settings.repositoryRoot(), Clock.systemUTC(), LlmResponses.JSON), transport);
            case "openai_api" -> new OpenAiApiProvider(settings, transport);
            case "mock" -> new MockLlmProvider();
            default -> throw new LlmException(LlmException.Code.CONFIG_INVALID);
        };
    }
    public static Path repositoryRoot() {
        Path cwd = Path.of("").toAbsolutePath().normalize();
        for (Path path = cwd; path != null; path = path.getParent()) if (Files.exists(path.resolve(".git"))) return path;
        // Distribution without .git: a backend working directory lives inside the repository root.
        return cwd.getFileName() != null && cwd.getFileName().toString().equals("backend") ? cwd.getParent() : cwd;
    }
}
