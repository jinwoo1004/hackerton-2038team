package com.xisnd.monitoring.file;

import com.xisnd.monitoring.common.ApiException;
import com.xisnd.monitoring.event.EventLevel;
import com.xisnd.monitoring.event.EventService;
import com.xisnd.monitoring.event.EventType;
import com.xisnd.monitoring.file.dto.ProjectFileResponse;
import com.xisnd.monitoring.project.Project;
import com.xisnd.monitoring.project.ProjectService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class ProjectFileService {

    private final ProjectFileRepository fileRepository;
    private final FileStorageService storageService;
    private final ProjectService projectService;
    private final EventService eventService;

    @Transactional(readOnly = true)
    public List<ProjectFileResponse> list(Long userId, Long projectId) {
        projectService.getOwnedProject(userId, projectId);
        return fileRepository.findByProjectIdOrderByCreatedAtAsc(projectId).stream()
                .map(ProjectFileResponse::from)
                .toList();
    }

    @Transactional
    public ProjectFileResponse upload(Long userId, Long projectId, FileType fileType, MultipartFile file) {
        Project project = projectService.getOwnedProject(userId, projectId);
        FileStorageService.StoredFile stored = storageService.store(project.getProjectCode(), fileType, file);

        ProjectFile saved = fileRepository.save(ProjectFile.builder()
                .projectId(projectId)
                .fileType(fileType)
                .originalFilename(stored.originalFilename())
                .storedFilename(stored.storedFilename())
                .filePath(stored.filePath())
                .fileSize(stored.size())
                .mimeType(stored.mimeType())
                .build());

        eventService.record(project, EventType.FILE_UPLOADED, EventLevel.INFO,
                objectOf(fileType) + " 올렸습니다", stored.originalFilename());
        return ProjectFileResponse.from(saved);
    }

    @Transactional
    public void delete(Long userId, Long projectId, Long fileId) {
        Project project = projectService.getOwnedProject(userId, projectId);
        ProjectFile file = fileRepository.findByIdAndProjectId(fileId, projectId)
                .orElseThrow(() -> ApiException.notFound("파일을 찾을 수 없습니다."));
        storageService.delete(file.getFilePath());
        fileRepository.delete(file);
        eventService.record(project, EventType.FILE_DELETED, EventLevel.INFO,
                objectOf(file.getFileType()) + " 삭제했습니다", file.getOriginalFilename());
    }

    private static String objectOf(FileType type) {
        return switch (type) {
            case RULE -> "규칙 문서를";
            case SOURCE -> "소스 파일을";
            case LOG -> "로그 파일을";
            default -> "파일을";
        };
    }
}
