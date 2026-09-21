package com.xisnd.monitoring.incident;

import com.xisnd.monitoring.project.Project;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Component;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class IncidentMetrics {
    private final IncidentRepository repository;
    public record Health(long total, long normal, long warning, long critical, long openIncidents) {}
    public record Trend(String date, long opened, long resolved) {}
    public Health health(List<Project> projects) {
        long warning = 0, critical = 0, openCount = 0;
        for (Project project : projects) {
            var open = repository.findByProjectIdAndStatus(project.getId(), IncidentStatus.OPEN);
            openCount += open.size();
            if (open.stream().anyMatch(i -> i.getSeverity() == IncidentSeverity.CRITICAL)) critical++;
            else if (!open.isEmpty()) warning++;
        }
        return new Health(projects.size(), projects.size() - warning - critical, warning, critical, openCount);
    }
    public List<Trend> trend(List<Project> projects) {
        var ids = projects.stream().map(Project::getId).toList();
        var events = ids.isEmpty() ? List.<Incident>of() : repository.findByProjectIdIn(ids);
        return java.util.stream.IntStream.range(0, 7).mapToObj(i -> {
            LocalDate date = LocalDate.now().minusDays(6-i);
            return new Trend(date.toString(), events.stream().filter(e -> e.getOpenedAt().toLocalDate().equals(date)).count(),
                events.stream().filter(e -> e.getResolvedAt() != null && e.getResolvedAt().toLocalDate().equals(date)).count());
        }).toList();
    }
}
