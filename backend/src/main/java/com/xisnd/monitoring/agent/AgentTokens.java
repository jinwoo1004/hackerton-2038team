package com.xisnd.monitoring.agent;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;

public final class AgentTokens {

    private static final String PREFIX = "agt_";
    private static final char[] ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private AgentTokens() {
    }

    public static String generate() {
        StringBuilder sb = new StringBuilder(PREFIX);
        for (int i = 0; i < 40; i++) {
            sb.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
        }
        return sb.toString();
    }

    public static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.trim().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public static String displayPrefix(String token) {
        return token.substring(0, Math.min(token.length(), 12));
    }
}
