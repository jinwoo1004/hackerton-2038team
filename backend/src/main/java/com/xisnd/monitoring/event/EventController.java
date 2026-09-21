package com.xisnd.monitoring.event;

import com.xisnd.monitoring.event.EventService.EventFilter;
import com.xisnd.monitoring.event.dto.EventPageResponse;
import com.xisnd.monitoring.event.dto.EventSummaryResponse;
import com.xisnd.monitoring.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @GetMapping
    public EventPageResponse search(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) EventLevel level,
            @RequestParam(required = false) Integer days,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "desc") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        return eventService.search(CurrentUser.id(), new EventFilter(projectId, level, days, q), page, size,
                "asc".equalsIgnoreCase(sort));
    }

    @GetMapping("/summary")
    public EventSummaryResponse summary(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Integer days,
            @RequestParam(required = false) String q) {
        return eventService.summary(CurrentUser.id(), new EventFilter(projectId, null, days, q));
    }
}
