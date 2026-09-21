package com.xisnd.monitoring.telemetry;

import com.xisnd.monitoring.security.CurrentUser;
import com.xisnd.monitoring.telemetry.TelemetryDtos.LogEntryResponse;
import com.xisnd.monitoring.telemetry.TelemetryDtos.MetricSeriesResponse;
import com.xisnd.monitoring.telemetry.TelemetryDtos.MonitoringOverview;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class TelemetryController {

    private final TelemetryService telemetryService;

    @GetMapping("/api/projects/{projectId}/log-entries")
    public List<LogEntryResponse> logs(@PathVariable Long projectId,
                                       @RequestParam(required = false) Long agentId,
                                       @RequestParam(required = false) String level,
                                       @RequestParam(required = false) String q,
                                       @RequestParam(required = false) Long afterId,
                                       @RequestParam(defaultValue = "200") int limit) {
        return telemetryService.logs(CurrentUser.id(), projectId, agentId, level, q, afterId, limit);
    }

    @GetMapping("/api/projects/{projectId}/metrics")
    public MetricSeriesResponse metrics(@PathVariable Long projectId,
                                        @RequestParam(required = false) Long agentId,
                                        @RequestParam(defaultValue = "60") int minutes) {
        return telemetryService.metrics(CurrentUser.id(), projectId, agentId, minutes);
    }

    @GetMapping("/api/monitoring/overview")
    public MonitoringOverview overview() {
        return telemetryService.overview(CurrentUser.id());
    }
}
