package com.xisnd.monitoring.file.dto;

import com.xisnd.monitoring.file.FileType;
import com.xisnd.monitoring.file.ProjectFile;
import java.time.LocalDateTime;

public record ProjectFileResponse(
        Long id,
        Long projectId,
        FileType fileType,
        String originalFilename,
        String storedFilename,
        long fileSize,
        String mimeType,
        LocalDateTime createdAt) {

    public static ProjectFileResponse from(ProjectFile file) {
        return new ProjectFileResponse(
                file.getId(),
                file.getProjectId(),
                file.getFileType(),
                file.getOriginalFilename(),
                file.getStoredFilename(),
                file.getFileSize(),
                file.getMimeType(),
                file.getCreatedAt());
    }
}
