package com.xisnd.monitoring.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.util.Base64;

/** Read-only auth.json subset from pinned official AuthDotJson/TokenData. No refresh or keyring access. */
final class CodexAuthFile {
    private static final int MAX_AUTH_BYTES = 128 * 1024;
    private final Path path, repositoryRoot;
    private final Clock clock;
    private final ObjectMapper mapper;
    CodexAuthFile(Path path, Path repositoryRoot, Clock clock, ObjectMapper mapper) {
        this.path = path; this.repositoryRoot = repositoryRoot; this.clock = clock; this.mapper = mapper;
    }
    record Credentials(String accessToken, String accountId) {
        @Override public String toString() { return "Credentials[redacted]"; }
    }
    Credentials read() {
        try {
            // Resolve symlinks every time so a hot-replaced file cannot point into the repository.
            Path real = path.toRealPath(), root = repositoryRoot.toRealPath();
            Path defaultHome = LlmSettings.defaultCodexHome();
            if (Files.exists(defaultHome)) defaultHome = defaultHome.toRealPath();
            if (real.startsWith(root) || real.startsWith(defaultHome) || !Files.isRegularFile(real)) throw new LlmException(LlmException.Code.LOCAL_AUTH_REQUIRED);
            // Also reject a path that traverses a repository/default-store junction and later exits it.
            for (Path ancestor = path.getParent(); ancestor != null; ancestor = ancestor.getParent()) {
                Path resolved = ancestor.toRealPath();
                if (resolved.startsWith(root) || resolved.startsWith(defaultHome)) throw new LlmException(LlmException.Code.LOCAL_AUTH_REQUIRED);
            }
            byte[] bytes;
            try (InputStream stream = Files.newInputStream(real)) { bytes = stream.readNBytes(MAX_AUTH_BYTES + 1); }
            if (bytes.length > MAX_AUTH_BYTES) throw new LlmException(LlmException.Code.LOCAL_AUTH_REQUIRED);
            var auth = mapper.readTree(bytes);
            if (!"chatgpt".equals(auth.path("auth_mode").asText())) throw new LlmException(LlmException.Code.LOCAL_AUTH_REQUIRED);
            var tokens = auth.path("tokens");
            String token = tokens.path("access_token").asText(), account = tokens.path("account_id").asText();
            if (!token.matches("[A-Za-z0-9_.-]{1,16000}") || !account.matches("[A-Za-z0-9_-]{1,200}"))
                throw new LlmException(LlmException.Code.LOCAL_AUTH_REQUIRED);
            // exp is a local expiry hint, not a substitute for server-side signature validation.
            String[] parts = token.split("\\.", -1);
            if (parts.length != 3 || parts[0].isEmpty() || parts[1].isEmpty() || parts[2].isEmpty()) throw new LlmException(LlmException.Code.LOCAL_AUTH_REQUIRED);
            if (!mapper.readTree(Base64.getUrlDecoder().decode(parts[0])).isObject()) throw new LlmException(LlmException.Code.LOCAL_AUTH_REQUIRED);
            var claims = mapper.readTree(Base64.getUrlDecoder().decode(parts[1]));
            if (!claims.isObject()) throw new LlmException(LlmException.Code.LOCAL_AUTH_REQUIRED);
            if (claims.has("exp") && (!claims.path("exp").canConvertToLong() || claims.path("exp").asLong() <= clock.instant().getEpochSecond()))
                throw new LlmException(LlmException.Code.LOCAL_AUTH_REQUIRED);
            return new Credentials(token, account);
        } catch (Exception ignored) { throw new LlmException(LlmException.Code.LOCAL_AUTH_REQUIRED); }
    }
    @Override public String toString() { return "CodexAuthFile[redacted]"; }
}
