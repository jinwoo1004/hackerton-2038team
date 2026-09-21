package com.xisnd.monitoring.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank(message = "이름을 입력해주세요.")
        @Size(max = 60, message = "이름은 60자 이내로 입력해주세요.")
        String name,

        @NotBlank(message = "이메일을 입력해주세요.")
        @Email(message = "이메일 형식이 올바르지 않습니다.")
        String email,

        @NotBlank(message = "비밀번호를 입력해주세요.")
        @Size(min = 8, max = 72, message = "비밀번호는 8자 이상으로 입력해주세요.")
        String password,

        @Size(max = 120, message = "회사명은 120자 이내로 입력해주세요.")
        String company,

        @Size(max = 120, message = "부서명은 120자 이내로 입력해주세요.")
        String department) {
}
