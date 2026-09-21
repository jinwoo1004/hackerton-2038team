package com.xisnd.monitoring.project.dto;

import com.xisnd.monitoring.project.Project;
import com.xisnd.monitoring.project.ProjectStatus;
import java.time.LocalDateTime;
import java.util.List;

public record ProjectResponse(
        Long id,
        String projectCode,
        String name,
        String nickname,
        String description,
        ProjectStatus status,
        List<TechnologyDto> technologies,
        long fileCount,
        LocalDateTime lastAnalyzedAt,
        long recentEventCount,
        Long createdBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    public static ProjectResponse of(Project project, long fileCount, long recentEventCount) {
        return new ProjectResponse(
                project.getId(),
                project.getProjectCode(),
                project.getName(),
                project.getNickname(),
                project.getDescription(),
                project.getStatus(),
                project.getTechnologies().stream().map(TechnologyDto::from).toList(),
                fileCount,
                project.getLastAnalyzedAt(),
                recentEventCount,
                project.getCreatedBy(),
                project.getCreatedAt(),
                project.getUpdatedAt());
    }
}
