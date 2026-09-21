package com.xisnd.monitoring.auth.dto;

import com.xisnd.monitoring.user.UserResponse;

public record AuthResponse(String token, UserResponse user) {
}
