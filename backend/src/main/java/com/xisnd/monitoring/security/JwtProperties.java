package com.xisnd.monitoring.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

// 운영에서는 APP_JWT_SECRET 환경변수로 주입
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(String secret, long expirationMinutes) {

    public JwtProperties {
        if (expirationMinutes <= 0) {
            expirationMinutes = 60 * 12;
        }
    }
}
