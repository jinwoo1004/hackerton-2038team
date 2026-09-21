package com.xisnd.monitoring.demo;

import com.xisnd.monitoring.agent.*;
import com.xisnd.monitoring.analysis.*;
import com.xisnd.monitoring.analysis.dto.AnalysisResponse;
import com.xisnd.monitoring.common.ApiException;
import com.xisnd.monitoring.file.*;
import com.xisnd.monitoring.incident.*;
import com.xisnd.monitoring.incident.IncidentDtos.IncidentResponse;
import com.xisnd.monitoring.project.*;
import com.xisnd.monitoring.telemetry.*;
import com.xisnd.monitoring.user.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Synthetic sandbox only; no network traffic or production server mutations. */
@Service
@Profile("demo")
@RequiredArgsConstructor
public class DemoService implements ApplicationRunner {
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final ProjectRepository projects;
    private final ProjectService projectService;
    private final AgentRepository agents;
    private final MetricPointRepository metrics;
    private final LogEntryRepository logs;
    private final ProjectFileRepository files;
    private final AnalysisRepository analyses;
    private final AnalysisService analysisService;
    private final IncidentRepository incidents;
    private final IncidentService incidentService;
    @Value("${app.demo.fixtures:../demo-fixtures}") private String fixturePath;
    @Value("${app.demo.heartbeat-enabled:true}") private boolean heartbeatEnabled;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.findByEmail("admin@xisnd.com").isEmpty()) users.save(User.builder().email("admin@xisnd.com")
            .password(passwordEncoder.encode("test1234")).name("데모 관리자").company("XI S&D").role(Role.ADMIN).build());
    }

    public record SeedResponse(Long projectId, Long agentId, Long analysisId) {}

    public record AgentTokenResponse(Long agentId, String token) {
        @Override public String toString() { return "AgentTokenResponse[agentId=" + agentId + ", token=REDACTED]"; }
    }

    /** Launcher-only credential handoff: raw token exists only in the response, never in storage or logs. */
    @Transactional
    public AgentTokenResponse rotateAgentToken(Long userId, Long projectId) {
        Project project = projectService.getOwnedProject(userId, projectId);
        if (!project.getProjectCode().equals("WALLPAD-DEMO")) throw ApiException.notFound("데모 프로젝트를 찾을 수 없습니다.");
        Agent agent = agents.findByProjectIdOrderByCreatedAtAsc(projectId).stream()
            .filter(a -> a.getName().equals("wallpad-demo-01")).findFirst()
            .orElseThrow(() -> ApiException.notFound("데모 에이전트를 찾을 수 없습니다."));
        String token = AgentTokens.generate();
        agent.rotateToken(token);
        return new AgentTokenResponse(agent.getId(), token);
    }

    @Transactional
    public synchronized SeedResponse seed(Long userId) {
        Project project = projects.findByCreatedByOrderByCreatedAtDesc(userId).stream()
            .filter(p -> p.getProjectCode().equals("WALLPAD-DEMO")).findFirst().orElse(null);
        if (project == null) {
            if (projects.existsByProjectCodeIgnoreCase("WALLPAD-DEMO")) throw ApiException.notFound("데모 프로젝트를 찾을 수 없습니다.");
            project = projects.save(Project.builder().projectCode("WALLPAD-DEMO").name("단지서버 월패드 연동 데모")
                .nickname("안전한 합성 시연").description("합성 소스·규칙·로그로 재현하는 오프라인 데모").createdBy(userId).build());
            project.replaceTechnologies(List.of(new Project.TechnologyValue(TechCategory.LANGUAGE, "TypeScript")));
        }
        final Long projectId = project.getId();
        Agent agent = agents.findByProjectIdOrderByCreatedAtAsc(projectId).stream().filter(a -> a.getName().equals("wallpad-demo-01")).findFirst().orElse(null);
        if (agent == null) {
            String token = AgentTokens.generate();
            agent = agents.save(Agent.builder().projectId(projectId).name("wallpad-demo-01").tokenHash(AgentTokens.hash(token)).tokenPrefix(AgentTokens.displayPrefix(token)).build());
        }
        LocalDateTime now = LocalDateTime.now();
        agent.touch("wallpad-demo-01", "Windows (synthetic demo)", "1.0-demo", "127.0.0.1", now);
        if (metrics.findFirstByAgentIdOrderByCollectedAtDesc(agent.getId()).isEmpty()) {
            for (int i = 0; i < 60; i++) addMetric(agent, now.minusMinutes(59-i), i);
            for (int i = 0; i < 12; i++) addLog(agent, now.minusMinutes(11-i), LogLevel.INFO,
                "[SYNTHETIC] cmd=0x0F target=wallpad-demo-01 responseMs=120 result=OK sequence=" + i);
        }
        if (files.countByProjectId(projectId) == 0) registerFixtures(projectId);
        Analysis latest = analyses.findFirstByProjectIdOrderByCreatedAtDesc(projectId).orElse(null);
        Long analysisId = latest == null || latest.getStatus() == AnalysisStatus.FAILED
            ? analysisService.start(userId, projectId).id() : latest.getId();
        return new SeedResponse(projectId, agent.getId(), analysisId);
    }

    private void registerFixtures(Long projectId) {
        Path root = Path.of(fixturePath).toAbsolutePath().normalize();
        if (!Files.isDirectory(root)) throw ApiException.badRequest("demo-fixtures 경로를 찾을 수 없습니다.");
        try (var stream = Files.list(root)) {
            for (Path path : stream.filter(Files::isRegularFile).sorted().toList()) {
                String name = path.getFileName().toString();
                if (name.equalsIgnoreCase("README.md")) continue;
                String ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
                FileType type = ext.equals("zip") ? FileType.SOURCE : ext.equals("log") ? FileType.LOG
                    : name.equals("rules.md") ? FileType.RULE : null;
                if (type != null) files.save(ProjectFile.builder().projectId(projectId).fileType(type).originalFilename(name)
                    .storedFilename(name).filePath(path.toString()).fileSize(Files.size(path)).mimeType("application/octet-stream").build());
            }
        } catch (java.io.IOException ex) { throw ApiException.badRequest("데모 파일을 읽지 못했습니다."); }
    }

    @Transactional
    public synchronized IncidentResponse trigger(Long userId, Long projectId, String scenario) {
        Project project = ownedDemo(userId, projectId);
        if (scenario == null || !Set.of("LATENCY", "ERROR_SPIKE").contains(scenario)) throw ApiException.badRequest("지원하지 않는 데모 시나리오입니다.");
        Agent agent = agents.findByProjectIdOrderByCreatedAtAsc(projectId).stream().filter(a -> a.getName().equals("wallpad-demo-01")).findFirst()
            .orElseThrow(() -> ApiException.badRequest("먼저 데모 데이터를 준비하세요."));
        IncidentRule rule = IncidentRule.valueOf(scenario);
        String key = "DEMO:" + projectId + ":" + scenario;
        var existing = incidents.findFirstByDedupKeyAndStatus(key, IncidentStatus.OPEN);
        if (existing.isPresent()) return IncidentResponse.of(existing.get(), project, agent.getName());
        boolean latency = scenario.equals("LATENCY");
        int current = latency ? 3200 : 450, timeout = latency ? 8 : 2, errors = latency ? 3 : 24;
        LocalDateTime now = LocalDateTime.now();
        agent.touch(null, null, null, null, now);
        for (int i = 0; i < timeout; i++) addLog(agent, now, LogLevel.WARN, "[SYNTHETIC] Timeout responseMs=" + current + " sequence=" + i);
        for (int i = 0; i < errors; i++) addLog(agent, now, LogLevel.ERROR, "[SYNTHETIC] " + scenario + " responseMs=" + current + " sequence=" + i);
        String detail = "합성 시나리오 " + scenario + "; baselineMs=120 currentMs=" + current + " timeoutCount=" + timeout + " errorCount=" + errors;
        Incident incident = incidentService.raise(new IncidentService.Signal(projectId, agent.getId(), rule, IncidentSeverity.CRITICAL, key,
            "wallpad-demo-01 " + rule.label(), detail, (double) (latency ? current : errors), latency ? 1000.0 : 10.0), now);
        return IncidentResponse.of(incident, project, agent.getName());
    }

    @Transactional
    public Map<String, Object> recover(Long userId, Long projectId) {
        ownedDemo(userId, projectId);
        var open = incidents.findByProjectIdAndStatus(projectId, IncidentStatus.OPEN);
        LocalDateTime now = LocalDateTime.now();
        open.forEach(i -> incidentService.resolve(i, now, "DEMO"));
        agents.findByProjectIdOrderByCreatedAtAsc(projectId).stream().filter(a -> a.getName().equals("wallpad-demo-01")).forEach(a -> {
            a.touch(null, null, null, null, now);
            if (!open.isEmpty()) {
                addMetric(a, now, 0);
                addLog(a, now, LogLevel.INFO, "[SYNTHETIC] RECOVERED responseMs=120 timeoutCount=0 errorCount=0");
            }
        });
        return Map.of("projectId", projectId, "resolved", open.size(), "status", "NORMAL");
    }

    private Project ownedDemo(Long userId, Long projectId) {
        Project project = projectService.getOwnedProject(userId, projectId);
        if (!project.getProjectCode().equals("WALLPAD-DEMO")) throw ApiException.badRequest("합성 데모 프로젝트에서만 사용할 수 있습니다.");
        return project;
    }

    @Scheduled(fixedDelay = 30000)
    @Transactional
    public void heartbeat() {
        if (!heartbeatEnabled) return;
        LocalDateTime now = LocalDateTime.now();
        for (Agent agent : agents.findAll()) if (agent.getName().equals("wallpad-demo-01") && projects.findById(agent.getProjectId())
            .map(p -> p.getProjectCode().equals("WALLPAD-DEMO")).orElse(false)) {
            agent.touch(null, null, null, null, now);
            addMetric(agent, now, now.getMinute() % 60);
        }
    }

    private void addMetric(Agent agent, LocalDateTime time, int i) {
        metrics.save(MetricPoint.builder().projectId(agent.getProjectId()).agentId(agent.getId()).collectedAt(time)
            .cpuPct((double)(28 + i*7%13)).memoryPct((double)(54 + i*3%9)).diskPct(42 + i*.05)
            .netInKbps(120.0 + i).netOutKbps(85.0 + i).build());
    }

    private void addLog(Agent agent, LocalDateTime time, LogLevel level, String message) {
        logs.save(LogEntry.builder().projectId(agent.getProjectId()).agentId(agent.getId()).source("synthetic-wallpad.log")
            .level(level).message(message).loggedAt(time).receivedAt(time).build());
    }
}
