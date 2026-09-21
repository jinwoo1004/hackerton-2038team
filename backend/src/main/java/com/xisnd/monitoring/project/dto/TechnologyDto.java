package com.xisnd.monitoring.project.dto;

import com.xisnd.monitoring.project.ProjectTechnology;
import com.xisnd.monitoring.project.TechCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record TechnologyDto(
        Long id,
        @NotNull(message = "기술 카테고리를 지정해주세요.") TechCategory category,
        @NotBlank(message = "기술 이름을 입력해주세요.") String name) {

    public static TechnologyDto from(ProjectTechnology entity) {
        return new TechnologyDto(entity.getId(), entity.getCategory(), entity.getName());
    }
}
