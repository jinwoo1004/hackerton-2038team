package com.xisnd.monitoring.file;

import com.xisnd.monitoring.file.dto.ProjectFileResponse;
import com.xisnd.monitoring.security.CurrentUser;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/projects/{projectId}/files")
@RequiredArgsConstructor
public class ProjectFileController {

    private final ProjectFileService fileService;

    @GetMapping
    public List<ProjectFileResponse> list(@PathVariable Long projectId) {
        return fileService.list(CurrentUser.id(), projectId);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProjectFileResponse> upload(
            @PathVariable Long projectId,
            @RequestPart("file") MultipartFile file,
            @RequestParam(defaultValue = "ETC") FileType fileType) {
        ProjectFileResponse saved = fileService.upload(CurrentUser.id(), projectId, fileType, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @DeleteMapping("/{fileId}")
    public ResponseEntity<Void> delete(@PathVariable Long projectId, @PathVariable Long fileId) {
        fileService.delete(CurrentUser.id(), projectId, fileId);
        return ResponseEntity.noContent().build();
    }
}
