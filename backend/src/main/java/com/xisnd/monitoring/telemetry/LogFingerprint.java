package com.xisnd.monitoring.telemetry;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.regex.Pattern;

public final class LogFingerprint {

    private static final Pattern UUID = Pattern.compile("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
    private static final Pattern HEX = Pattern.compile("\\b0x[0-9a-fA-F]+\\b|\\b[0-9a-fA-F]{12,}\\b");
    private static final Pattern QUOTED = Pattern.compile("\"[^\"]*\"|'[^']*'");
    private static final Pattern NUMBER = Pattern.compile("\\d+");
    private static final Pattern SPACES = Pattern.compile("\\s+");
    private static final Pattern TIMESTAMP_HEAD = Pattern.compile(
            "^\\[?\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}:\\d{2}([.,]\\d+)?(Z|[+-]\\d{2}:?\\d{2})?\\]?\\s*");

    private LogFingerprint() {
    }

    public static String normalize(String message) {
        if (message == null) {
            return "";
        }
        String line = message.lines().findFirst().orElse("");
        line = TIMESTAMP_HEAD.matcher(line).replaceFirst("");
        line = UUID.matcher(line).replaceAll("<id>");
        line = HEX.matcher(line).replaceAll("<hex>");
        line = QUOTED.matcher(line).replaceAll("<str>");
        line = NUMBER.matcher(line).replaceAll("<n>");
        line = SPACES.matcher(line).replaceAll(" ").trim().toLowerCase(Locale.ROOT);
        return line.length() > 300 ? line.substring(0, 300) : line;
    }

    public static String of(String message) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-1").digest(normalize(message).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 8);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
