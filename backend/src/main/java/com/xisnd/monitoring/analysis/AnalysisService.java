package com.xisnd.monitoring.analysis;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xisnd.monitoring.analysis.dto.AnalysisResponse;
import com.xisnd.monitoring.common.ApiException;
import com.xisnd.monitoring.event.EventLevel;
import com.xisnd.monitoring.event.EventService;
import com.xisnd.monitoring.event.EventType;
import com.xisnd.monitoring.project.Project;
import com.xisnd.monitoring.project.ProjectService;
import com.xisnd.monitoring.project.ProjectStatus;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnalysisService {

    private final AnalysisRepository analysisRepository;
    private final ProjectService projectService;
    private final AnalysisServiceClient client;
    private final AnalysisRunner runner;
    private final ObjectMapper objectMapper;
    private final EventService eventService;

    @Transactional
    public AnalysisResponse start(Long userId, Long projectId) {
        Project project = projectService.getOwnedProject(userId, projectId);
        analysisRepository.findFirstByProjectIdOrderByCreatedAtDesc(projectId)
                .filter(Analysis::isRunning)
                .ifPresent(a -> {
                    throw ApiException.conflict("이미 분석이 진행 중입니다.");
                });

        Analysis analysis = analysisRepository.save(Analysis.builder()
                .projectId(projectId)
                .status(AnalysisStatus.QUEUED)
                .startedAt(LocalDateTime.now())
                .build());

        if (!client.isEnabled()) {
            analysis.fail("분석 서비스가 꺼져 있습니다. APP_ANALYSIS_ENABLED=true 로 백엔드를 실행해주세요.");
            eventService.record(project, EventType.ANALYSIS_FAILED, EventLevel.ERROR, "분석을 시작하지 못했습니다", analysis.getSummary());
            return AnalysisResponse.from(analysis);
        }

        project.changeStatus(ProjectStatus.ANALYZING);
        eventService.record(project, EventType.ANALYSIS_STARTED, EventLevel.INFO, "분석을 시작했습니다", null);
        Long analysisId = analysis.getId();
        // 커밋된 뒤에 비동기로 실행해야 러너가 행을 읽을 수 있다
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                runner.run(analysisId);
            }
        });
        return AnalysisResponse.from(analysis);
    }

    @Transactional(readOnly = true)
    public AnalysisResponse latest(Long userId, Long projectId) {
        projectService.getOwnedProject(userId, projectId);
        return analysisRepository.findFirstByProjectIdOrderByCreatedAtDesc(projectId)
                .map(a -> AnalysisResponse.from(a, parse(a.getResultJson())))
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<AnalysisResponse> history(Long userId, Long projectId) {
        projectService.getOwnedProject(userId, projectId);
        return analysisRepository.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
                .map(AnalysisResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public AnalysisResponse get(Long userId, Long projectId, Long analysisId) {
        projectService.getOwnedProject(userId, projectId);
        return analysisRepository.findById(analysisId)
                .filter(a -> a.getProjectId().equals(projectId))
                .map(a -> AnalysisResponse.from(a, parse(a.getResultJson())))
                .orElseThrow(() -> ApiException.notFound("분석을 찾을 수 없습니다."));
    }

    private JsonNode parse(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException e) {
            log.warn("분석 결과 파싱 실패 - {}", e.getMessage());
            return null;
        }
    }
}
