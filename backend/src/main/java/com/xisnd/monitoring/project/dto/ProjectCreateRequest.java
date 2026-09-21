package com.xisnd.monitoring.project.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ProjectCreateRequest(
        @NotBlank(message = "프로젝트 이름을 입력해주세요.")
        @Size(max = 120, message = "프로젝트 이름은 120자 이내로 입력해주세요.")
        String name,

        @Size(max = 120, message = "프로젝트 닉네임은 120자 이내로 입력해주세요.")
        String nickname,

        @NotBlank(message = "프로젝트 코드를 입력해주세요.")
        @Pattern(regexp = "^[A-Za-z0-9_-]{2,40}$", message = "프로젝트 코드는 영문/숫자/-/_ 2~40자로 입력해주세요.")
        String projectCode,

        @Size(max = 1000, message = "프로젝트 설명은 1000자 이내로 입력해주세요.")
        String description,

        @Valid List<TechnologyDto> technologies) {
}
