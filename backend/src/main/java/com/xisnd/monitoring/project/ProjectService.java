package com.xisnd.monitoring.project;

import com.xisnd.monitoring.agent.AgentRepository;
import com.xisnd.monitoring.alert.AlertRuleRepository;
import com.xisnd.monitoring.analysis.AnalysisRepository;
import com.xisnd.monitoring.common.ApiException;
import com.xisnd.monitoring.event.EventLevel;
import com.xisnd.monitoring.event.EventService;
import com.xisnd.monitoring.event.EventType;
import com.xisnd.monitoring.file.FileStorageService;
import com.xisnd.monitoring.file.ProjectFileRepository;
import com.xisnd.monitoring.incident.IncidentRepository;
import com.xisnd.monitoring.project.dto.ProjectCreateRequest;
import com.xisnd.monitoring.project.dto.ProjectResponse;
import com.xisnd.monitoring.project.dto.ProjectUpdateRequest;
import com.xisnd.monitoring.project.dto.TechnologyDto;
import com.xisnd.monitoring.telemetry.LogEntryRepository;
import com.xisnd.monitoring.telemetry.MetricPointRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectFileRepository fileRepository;
    private final AnalysisRepository analysisRepository;
    private final FileStorageService fileStorageService;
    private final EventService eventService;
    private final AgentRepository agentRepository;
    private final LogEntryRepository logEntryRepository;
    private final MetricPointRepository metricPointRepository;
    private final IncidentRepository incidentRepository;
    private final AlertRuleRepository alertRuleRepository;

    @Transactional(readOnly = true)
    public List<ProjectResponse> list(Long userId) {
        return projectRepository.findByCreatedByOrderByCreatedAtDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse get(Long userId, Long projectId) {
        return toResponse(getOwnedProject(userId, projectId));
    }

    @Transactional(readOnly = true)
    public Project getOwnedProject(Long userId, Long projectId) {
        Project project = projectRepository.findWithTechnologiesById(projectId)
                .orElseThrow(() -> ApiException.notFound("프로젝트를 찾을 수 없습니다."));
        if (!project.getCreatedBy().equals(userId)) {
            throw ApiException.notFound("프로젝트를 찾을 수 없습니다.");
        }
        return project;
    }

    @Transactional
    public ProjectResponse create(Long userId, ProjectCreateRequest request) {
        String code = request.projectCode().trim();
        if (projectRepository.existsByProjectCodeIgnoreCase(code)) {
            throw ApiException.conflict("이미 사용 중인 프로젝트 코드입니다.");
        }

        Project project = Project.builder()
                .projectCode(code)
                .name(request.name().trim())
                .nickname(blankToNull(request.nickname()))
                .description(blankToNull(request.description()))
                .createdBy(userId)
                .build();
        project.replaceTechnologies(toTechnologyValues(request.technologies()));

        Project saved = projectRepository.save(project);
        eventService.record(saved, EventType.PROJECT_CREATED, EventLevel.INFO, "프로젝트를 만들었습니다", saved.getProjectCode());
        return toResponse(saved);
    }

    @Transactional
    public ProjectResponse update(Long userId, Long projectId, ProjectUpdateRequest request) {
        Project project = getOwnedProject(userId, projectId);
        project.updateBasics(request.name(), blankToNull(request.nickname()), blankToNull(request.description()));
        if (request.technologies() != null) {
            project.replaceTechnologies(toTechnologyValues(request.technologies()));
        }
        if (request.status() != null) {
            project.changeStatus(request.status());
        }
        eventService.record(project, EventType.PROJECT_UPDATED, EventLevel.INFO, "프로젝트 정보를 수정했습니다", null);
        return toResponse(project);
    }

    @Transactional
    public void delete(Long userId, Long projectId) {
        Project project = getOwnedProject(userId, projectId);
        eventService.record(project, EventType.PROJECT_DELETED, EventLevel.WARNING, "프로젝트를 삭제했습니다", project.getProjectCode());
        fileRepository.findByProjectIdOrderByCreatedAtAsc(projectId)
                .forEach(f -> fileStorageService.delete(f.getFilePath()));
        fileRepository.deleteByProjectId(projectId);
        analysisRepository.deleteByProjectId(projectId);
        logEntryRepository.deleteByProject(projectId);
        metricPointRepository.deleteByProject(projectId);
        incidentRepository.deleteByProject(projectId);
        agentRepository.deleteByProjectId(projectId);
        alertRuleRepository.deleteByProjectId(projectId);
        projectRepository.delete(project);
    }

    @Transactional(readOnly = true)
    public boolean isCodeAvailable(String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        return !projectRepository.existsByProjectCodeIgnoreCase(code.trim());
    }

    private List<Project.TechnologyValue> toTechnologyValues(List<TechnologyDto> technologies) {
        if (technologies == null) {
            return List.of();
        }
        return technologies.stream()
                .map(t -> new Project.TechnologyValue(t.category(), t.name()))
                .toList();
    }

    private ProjectResponse toResponse(Project project) {
        return ProjectResponse.of(project, fileRepository.countByProjectId(project.getId()),
                eventService.countRecent(project.getId()));
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
