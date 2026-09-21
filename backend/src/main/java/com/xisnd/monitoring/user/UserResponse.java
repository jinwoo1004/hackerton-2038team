package com.xisnd.monitoring.user;

import java.time.LocalDateTime;

public record UserResponse(
        Long id,
        String email,
        String name,
        String company,
        String department,
        Role role,
        LocalDateTime createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getCompany(),
                user.getDepartment(),
                user.getRole(),
                user.getCreatedAt());
    }
}
