package com.xisnd.monitoring.demo;

import com.xisnd.monitoring.security.CurrentUser;
import com.xisnd.monitoring.incident.IncidentDtos.IncidentResponse;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("demo")
@RequestMapping("/api/demo")
@RequiredArgsConstructor
public class DemoController {
    private final DemoService demo;
    public record Trigger(String scenario) {}
    @PostMapping("/seed") public DemoService.SeedResponse seed() { return demo.seed(CurrentUser.id()); }
    @PostMapping("/projects/{id}/trigger") public IncidentResponse trigger(@PathVariable Long id, @RequestBody Trigger request) {
        return demo.trigger(CurrentUser.id(), id, request.scenario());
    }
    @PostMapping("/projects/{id}/recover") public Map<String, Object> recover(@PathVariable Long id) {
        return demo.recover(CurrentUser.id(), id);
    }
    @PostMapping("/projects/{id}/agent-token")
    public org.springframework.http.ResponseEntity<DemoService.AgentTokenResponse> agentToken(@PathVariable Long id) {
        return org.springframework.http.ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
            .header("Pragma", "no-cache").body(demo.rotateAgentToken(CurrentUser.id(), id));
    }
}
