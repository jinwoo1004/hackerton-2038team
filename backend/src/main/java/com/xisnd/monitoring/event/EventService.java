package com.xisnd.monitoring.event;

import com.xisnd.monitoring.event.dto.EventPageResponse;
import com.xisnd.monitoring.event.dto.EventResponse;
import com.xisnd.monitoring.event.dto.EventSummaryResponse;
import com.xisnd.monitoring.project.Project;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EventService {

    private final ActivityEventRepository repository;

    @Transactional
    public void record(Project project, EventType type, EventLevel level, String title, String message) {
        repository.save(ActivityEvent.builder()
                .userId(project.getCreatedBy())
                .projectId(project.getId())
                .projectName(project.getName())
                .type(type)
                .level(level)
                .title(title)
                .message(message)
                .build());
    }

    @Transactional(readOnly = true)
    public EventPageResponse search(Long userId, EventFilter filter, int page, int size, boolean ascending) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        Sort.Direction direction = ascending ? Sort.Direction.ASC : Sort.Direction.DESC;
        Page<ActivityEvent> result = repository.search(userId, filter.projectId(), filter.level(), since(filter.days()),
                pattern(filter.q()), PageRequest.of(Math.max(page, 0), safeSize, Sort.by(direction, "createdAt", "id")));
        return new EventPageResponse(
                result.getContent().stream().map(EventResponse::from).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.hasNext());
    }

    @Transactional(readOnly = true)
    public EventSummaryResponse summary(Long userId, EventFilter filter) {
        long error = 0;
        long warning = 0;
        long info = 0;
        for (Object[] row : repository.countByLevel(userId, filter.projectId(), since(filter.days()), pattern(filter.q()))) {
            long count = (Long) row[1];
            switch ((EventLevel) row[0]) {
                case ERROR -> error = count;
                case WARNING -> warning = count;
                case INFO -> info = count;
            }
        }
        LocalDateTime now = LocalDateTime.now();
        long last24h = repository.countBetween(userId, filter.projectId(), now.minusHours(24), now.plusMinutes(1));
        long prev24h = repository.countBetween(userId, filter.projectId(), now.minusHours(48), now.minusHours(24));
        return new EventSummaryResponse(error + warning + info, error, warning, info, last24h, prev24h);
    }

    @Transactional(readOnly = true)
    public List<EventResponse> recent(Long userId, int size) {
        return repository.search(userId, null, null, null, null,
                        PageRequest.of(0, size, Sort.by(Sort.Direction.DESC, "createdAt", "id")))
                .getContent().stream()
                .map(EventResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public long countRecent(Long projectId) {
        return repository.countByProjectIdAndCreatedAtAfter(projectId, LocalDateTime.now().minusDays(7));
    }

    private static LocalDateTime since(Integer days) {
        return days == null || days <= 0 ? null : LocalDateTime.now().minusDays(days);
    }

    private static String pattern(String q) {
        if (q == null || q.isBlank()) {
            return null;
        }
        String escaped = q.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }

    public record EventFilter(Long projectId, EventLevel level, Integer days, String q) {
    }
}
