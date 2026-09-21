package com.xisnd.monitoring.project.dto;

import com.xisnd.monitoring.project.ProjectStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;

// 프로젝트 코드는 수정 불가
public record ProjectUpdateRequest(
        @Size(max = 120, message = "프로젝트 이름은 120자 이내로 입력해주세요.") String name,
        @Size(max = 120, message = "프로젝트 닉네임은 120자 이내로 입력해주세요.") String nickname,
        @Size(max = 1000, message = "프로젝트 설명은 1000자 이내로 입력해주세요.") String description,
        ProjectStatus status,
        @Valid List<TechnologyDto> technologies) {
}
