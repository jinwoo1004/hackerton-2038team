package com.xisnd.monitoring.agent;

import com.xisnd.monitoring.agent.AgentDtos.AgentCreateRequest;
import com.xisnd.monitoring.agent.AgentDtos.AgentCreatedResponse;
import com.xisnd.monitoring.agent.AgentDtos.AgentResponse;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects/{projectId}/agents")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;

    @GetMapping
    public List<AgentResponse> list(@PathVariable Long projectId) {
        return agentService.list(CurrentUser.id(), projectId);
    }

    @PostMapping
    public ResponseEntity<AgentCreatedResponse> create(@PathVariable Long projectId,
                                                       @Valid @RequestBody AgentCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(agentService.create(CurrentUser.id(), projectId, request.name()));
    }

    @DeleteMapping("/{agentId}")
    public ResponseEntity<Void> delete(@PathVariable Long projectId, @PathVariable Long agentId) {
        agentService.delete(CurrentUser.id(), projectId, agentId);
        return ResponseEntity.noContent().build();
    }
}
