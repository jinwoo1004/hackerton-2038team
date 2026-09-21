package com.xisnd.monitoring.common;

import java.time.LocalDateTime;

public record ErrorResponse(int status, String message, LocalDateTime timestamp) {

    public static ErrorResponse of(int status, String message) {
        return new ErrorResponse(status, message, LocalDateTime.now());
    }
}
