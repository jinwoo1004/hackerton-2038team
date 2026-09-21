package com.xisnd.monitoring.event.dto;

import com.xisnd.monitoring.event.ActivityEvent;
import com.xisnd.monitoring.event.EventLevel;
import com.xisnd.monitoring.event.EventType;
import java.time.LocalDateTime;

public record EventResponse(
        Long id,
        Long projectId,
        String projectName,
        EventType type,
        EventLevel level,
        String title,
        String message,
        LocalDateTime createdAt) {

    public static EventResponse from(ActivityEvent e) {
        return new EventResponse(e.getId(), e.getProjectId(), e.getProjectName(), e.getType(), e.getLevel(),
                e.getTitle(), e.getMessage(), e.getCreatedAt());
    }
}
