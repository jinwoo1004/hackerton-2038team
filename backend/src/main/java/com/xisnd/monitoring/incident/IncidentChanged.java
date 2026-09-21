package com.xisnd.monitoring.incident;

public record IncidentChanged(Long incidentId, Kind kind) {

    public enum Kind {
        OPENED,
        ESCALATED,
        RESOLVED
    }
}
