package com.xisnd.monitoring.analysis;

import com.xisnd.monitoring.analysis.dto.AnalysisResponse;
import com.xisnd.monitoring.security.CurrentUser;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects/{projectId}/analysis")
@RequiredArgsConstructor
public class AnalysisController {

    private final AnalysisService analysisService;

    @PostMapping
    public ResponseEntity<AnalysisResponse> start(@PathVariable Long projectId) {
        AnalysisResponse started = analysisService.start(CurrentUser.id(), projectId);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(started);
    }

    @GetMapping("/latest")
    public ResponseEntity<AnalysisResponse> latest(@PathVariable Long projectId) {
        return ResponseEntity.ok(analysisService.latest(CurrentUser.id(), projectId));
    }

    @GetMapping("/history")
    public List<AnalysisResponse> history(@PathVariable Long projectId) {
        return analysisService.history(CurrentUser.id(), projectId);
    }

    @GetMapping("/{analysisId:\\d+}")
    public AnalysisResponse get(@PathVariable Long projectId, @PathVariable Long analysisId) {
        return analysisService.get(CurrentUser.id(), projectId, analysisId);
    }
}
