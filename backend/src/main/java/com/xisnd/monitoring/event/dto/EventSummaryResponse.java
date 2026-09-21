package com.xisnd.monitoring.event.dto;

public record EventSummaryResponse(long total, long error, long warning, long info, long last24h, long prev24h) {
}
