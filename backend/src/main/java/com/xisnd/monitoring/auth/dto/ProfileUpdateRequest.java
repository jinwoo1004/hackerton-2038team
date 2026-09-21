package com.xisnd.monitoring.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProfileUpdateRequest(
        @NotBlank(message = "이름을 입력해주세요.") @Size(max = 60, message = "이름은 60자 이하로 입력해주세요.") String name,
        @Size(max = 120, message = "회사명은 120자 이하로 입력해주세요.") String company,
        @Size(max = 120, message = "부서명은 120자 이하로 입력해주세요.") String department) {
}
