package com.xisnd.monitoring.project;

import com.xisnd.monitoring.project.dto.CodeCheckResponse;
import com.xisnd.monitoring.project.dto.ProjectCreateRequest;
import com.xisnd.monitoring.project.dto.ProjectResponse;
import com.xisnd.monitoring.project.dto.ProjectUpdateRequest;
import com.xisnd.monitoring.security.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @GetMapping
    public List<ProjectResponse> list() {
        return projectService.list(CurrentUser.id());
    }

    @GetMapping("/{projectId}")
    public ProjectResponse get(@PathVariable Long projectId) {
        return projectService.get(CurrentUser.id(), projectId);
    }

    @PostMapping
    public ResponseEntity<ProjectResponse> create(@Valid @RequestBody ProjectCreateRequest request) {
        ProjectResponse created = projectService.create(CurrentUser.id(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{projectId}")
    public ProjectResponse update(@PathVariable Long projectId, @Valid @RequestBody ProjectUpdateRequest request) {
        return projectService.update(CurrentUser.id(), projectId, request);
    }

    @DeleteMapping("/{projectId}")
    public ResponseEntity<Void> delete(@PathVariable Long projectId) {
        projectService.delete(CurrentUser.id(), projectId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/check-code")
    public CodeCheckResponse checkCode(@RequestParam String code) {
        return new CodeCheckResponse(projectService.isCodeAvailable(code));
    }
}
