package com.xisnd.monitoring.analysis;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xisnd.monitoring.analysis.dto.AnalysisServiceRequest;
import com.xisnd.monitoring.analysis.dto.AnalysisServiceResponse;
import com.xisnd.monitoring.event.EventLevel;
import com.xisnd.monitoring.event.EventService;
import com.xisnd.monitoring.event.EventType;
import com.xisnd.monitoring.file.FileType;
import com.xisnd.monitoring.file.ProjectFile;
import com.xisnd.monitoring.file.ProjectFileRepository;
import com.xisnd.monitoring.project.Project;
import com.xisnd.monitoring.project.ProjectRepository;
import com.xisnd.monitoring.project.ProjectStatus;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Slf4j
@Component
@RequiredArgsConstructor
public class AnalysisRunner {

    private final AnalysisRepository analysisRepository;
    private final ProjectRepository projectRepository;
    private final ProjectFileRepository fileRepository;
    private final AnalysisServiceClient client;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate tx;
    private final EventService eventService;

    @Async("analysisExecutor")
    public void run(Long analysisId) {
        try {
            AnalysisServiceRequest request = tx.execute(status -> prepare(analysisId));
            if (request == null) {
                return;
            }
            // 분석 서비스 호출은 트랜잭션 밖에서
            AnalysisServiceResponse response = client.requestAnalysis(request).orElse(null);
            tx.executeWithoutResult(status -> apply(analysisId, response));
        } catch (RuntimeException e) {
            log.error("분석 실행 실패 - analysisId={}", analysisId, e);
            tx.executeWithoutResult(status -> analysisRepository.findById(analysisId).ifPresent(a -> {
                a.fail("분석 중 오류가 발생했습니다.");
                projectRepository.findById(a.getProjectId()).ifPresent(p -> {
                    p.changeStatus(ProjectStatus.ERROR);
                    eventService.record(p, EventType.ANALYSIS_FAILED, EventLevel.ERROR, "분석에 실패했습니다", a.getSummary());
                });
            }));
        }
    }

    private AnalysisServiceRequest prepare(Long analysisId) {
        Analysis analysis = analysisRepository.findById(analysisId).orElse(null);
        if (analysis == null || !analysis.isRunning()) {
            return null;
        }
        Project project = projectRepository.findWithTechnologiesById(analysis.getProjectId()).orElse(null);
        if (project == null) {
            analysis.fail("프로젝트를 찾을 수 없습니다.");
            return null;
        }
        analysis.changeStatus(AnalysisStatus.ANALYZING);

        List<ProjectFile> files = fileRepository.findByProjectIdOrderByCreatedAtAsc(project.getId());
        String source = files.stream()
                .filter(f -> f.getFileType() == FileType.SOURCE)
                .map(ProjectFile::getFilePath)
                .reduce((first, second) -> second)
                .orElse(null);
        return new AnalysisServiceRequest(
                project.getId(),
                project.getProjectCode(),
                project.getTechnologies().stream().map(t -> t.getName()).toList(),
                pathsOf(files, FileType.RULE),
                source,
                pathsOf(files, FileType.LOG),
                files.stream().collect(Collectors.toMap(
                        ProjectFile::getFilePath, ProjectFile::getOriginalFilename, (a, b) -> a)));
    }

    private void apply(Long analysisId, AnalysisServiceResponse response) {
        Analysis analysis = analysisRepository.findById(analysisId).orElse(null);
        if (analysis == null) {
            return;
        }
        Project project = projectRepository.findById(analysis.getProjectId()).orElse(null);

        if (response == null) {
            analysis.fail("분석 서비스에 연결하지 못했습니다. 분석 서비스 실행 상태를 확인해주세요.");
            if (project != null) {
                project.changeStatus(ProjectStatus.ERROR);
                eventService.record(project, EventType.ANALYSIS_FAILED, EventLevel.ERROR, "분석에 실패했습니다", analysis.getSummary());
            }
            return;
        }

        analysis.attachExternalId(response.analysisId());
        if ("COMPLETED".equalsIgnoreCase(response.status())) {
            analysis.complete(response.summary(), toJson(response));
            JsonNode overview = response.result() == null ? null : response.result().path("overview");
            if (overview != null && !overview.isMissingNode()) {
                analysis.applyOverview(overview.path("score").asInt(), overview.path("grade").asText(null),
                        overview.path("critical").asInt(), overview.path("warning").asInt(), overview.path("info").asInt());
            }
            if (project != null) {
                project.changeStatus(ProjectStatus.ACTIVE);
                project.markAnalyzed(LocalDateTime.now());
                int critical = analysis.getCriticalCount() == null ? 0 : analysis.getCriticalCount();
                String detail = analysis.getScore() == null ? null
                        : "품질 점수 %d점(%s), 심각 %d건, 주의 %d건".formatted(analysis.getScore(), analysis.getGrade(),
                                critical, analysis.getWarningCount());
                eventService.record(project, EventType.ANALYSIS_COMPLETED,
                        critical > 0 ? EventLevel.WARNING : EventLevel.INFO, "분석이 완료되었습니다", detail);
            }
        } else {
            analysis.fail(response.summary() != null ? response.summary() : "분석에 실패했습니다.");
            if (project != null) {
                project.changeStatus(ProjectStatus.ERROR);
                eventService.record(project, EventType.ANALYSIS_FAILED, EventLevel.ERROR, "분석에 실패했습니다", analysis.getSummary());
            }
        }
    }

    private String toJson(AnalysisServiceResponse response) {
        if (response.result() == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(response.result());
        } catch (JsonProcessingException e) {
            log.warn("분석 결과 저장 실패 - {}", e.getMessage());
            return null;
        }
    }

    private static List<String> pathsOf(List<ProjectFile> files, FileType type) {
        return files.stream().filter(f -> f.getFileType() == type).map(ProjectFile::getFilePath).toList();
    }
}
