package com.xisnd.monitoring.event.dto;

import java.util.List;

public record EventPageResponse(List<EventResponse> items, int page, int size, long total, boolean hasNext) {
}
