package com.xisnd.monitoring.telemetry;

import java.util.Locale;

public enum LogLevel {
    TRACE,
    DEBUG,
    INFO,
    WARN,
    ERROR,
    FATAL,
    UNKNOWN;

    public boolean isError() {
        return this == ERROR || this == FATAL;
    }

    public static LogLevel parse(String value) {
        if (value == null || value.isBlank()) {
            return UNKNOWN;
        }
        return switch (value.trim().toUpperCase(Locale.ROOT)) {
            case "TRACE", "VERBOSE" -> TRACE;
            case "DEBUG", "DBG" -> DEBUG;
            case "INFO", "INFORMATION", "NOTICE" -> INFO;
            case "WARN", "WARNING" -> WARN;
            case "ERROR", "ERR", "SEVERE" -> ERROR;
            case "FATAL", "CRITICAL", "CRIT", "EMERG", "ALERT", "PANIC" -> FATAL;
            default -> UNKNOWN;
        };
    }
}
