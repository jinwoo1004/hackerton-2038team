package com.xisnd.monitoring.incident;

import com.xisnd.monitoring.incident.IncidentDtos.IncidentResponse;
import com.xisnd.monitoring.security.CurrentUser;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;

    @GetMapping
    public List<IncidentResponse> list(@RequestParam(required = false) Long projectId,
                                       @RequestParam(required = false) IncidentStatus status,
                                       @RequestParam(defaultValue = "50") int limit) {
        return incidentService.search(CurrentUser.id(), projectId, status, limit);
    }

    @PostMapping("/{incidentId}/resolve")
    public IncidentResponse resolve(@PathVariable Long incidentId) {
        return incidentService.resolveManually(CurrentUser.id(), incidentId);
    }

    @GetMapping("/{incidentId}/preview")
    public java.util.Map<String, Object> preview(@PathVariable Long incidentId) {
        return incidentService.preview(CurrentUser.id(), incidentId);
    }
}
