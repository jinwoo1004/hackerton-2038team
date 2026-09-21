package com.xisnd.monitoring.analysis;

import com.xisnd.monitoring.event.EventLevel;
import com.xisnd.monitoring.event.EventService;
import com.xisnd.monitoring.event.EventType;
import com.xisnd.monitoring.project.ProjectRepository;
import com.xisnd.monitoring.project.ProjectStatus;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class AnalysisRecovery {

    private final AnalysisRepository analysisRepository;
    private final ProjectRepository projectRepository;
    private final EventService eventService;

    @Transactional
    @EventListener(ApplicationReadyEvent.class)
    public void failInterrupted() {
        List<Analysis> running = analysisRepository.findByStatusIn(List.of(AnalysisStatus.QUEUED, AnalysisStatus.ANALYZING));
        for (Analysis analysis : running) {
            analysis.fail("서버가 다시 시작되어 분석이 중단되었습니다. 다시 실행해주세요.");
            projectRepository.findById(analysis.getProjectId()).ifPresent(p -> {
                if (p.getStatus() == ProjectStatus.ANALYZING) {
                    p.changeStatus(p.getLastAnalyzedAt() != null ? ProjectStatus.ACTIVE : ProjectStatus.READY);
                }
                eventService.record(p, EventType.ANALYSIS_FAILED, EventLevel.WARNING, "분석이 중단되었습니다", analysis.getSummary());
            });
        }
        if (!running.isEmpty()) {
            log.info("중단된 분석 {}건을 실패 처리했습니다.", running.size());
        }
    }
}
