package com.xisnd.monitoring.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PasswordChangeRequest(
        @NotBlank(message = "현재 비밀번호를 입력해주세요.") String currentPassword,
        @NotBlank(message = "새 비밀번호를 입력해주세요.")
        @Size(min = 8, max = 72, message = "새 비밀번호는 8자 이상으로 입력해주세요.") String newPassword) {
}
