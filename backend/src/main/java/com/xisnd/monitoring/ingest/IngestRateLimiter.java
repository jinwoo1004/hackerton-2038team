package com.xisnd.monitoring.ingest;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class IngestRateLimiter {

    private static final long WINDOW_MS = 10_000;
    private static final int MAX_PER_WINDOW = 50;

    private final Map<Long, Window> windows = new ConcurrentHashMap<>();

    public boolean tryAcquire(Long agentId) {
        long now = System.currentTimeMillis();
        Window window = windows.compute(agentId, (id, w) ->
                w == null || now - w.startedAt >= WINDOW_MS ? new Window(now, 1) : new Window(w.startedAt, w.count + 1));
        return window.count <= MAX_PER_WINDOW;
    }

    private record Window(long startedAt, int count) {
    }
}
