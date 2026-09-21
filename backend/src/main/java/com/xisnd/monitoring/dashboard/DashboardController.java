package com.xisnd.monitoring.dashboard;

import com.xisnd.monitoring.dashboard.DashboardDtos.AnalysisListItem;
import com.xisnd.monitoring.dashboard.DashboardDtos.DashboardResponse;
import com.xisnd.monitoring.dashboard.DashboardDtos.SystemStatus;
import com.xisnd.monitoring.security.CurrentUser;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/api/dashboard")
    public DashboardResponse dashboard() {
        return dashboardService.dashboard(CurrentUser.id());
    }

    @GetMapping("/api/analyses")
    public List<AnalysisListItem> analyses(@RequestParam(defaultValue = "100") int limit) {
        return dashboardService.analyses(CurrentUser.id(), limit);
    }

    @GetMapping("/api/system/status")
    public SystemStatus systemStatus() {
        return dashboardService.systemStatus(CurrentUser.id());
    }
}
