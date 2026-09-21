package com.xisnd.monitoring.llm;

import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

public final class LlmCancellation {
    private final AtomicBoolean cancelled = new AtomicBoolean();
    private final CopyOnWriteArrayList<Runnable> listeners = new CopyOnWriteArrayList<>();
    public void cancel() {
        if (cancelled.compareAndSet(false, true)) listeners.forEach(Runnable::run);
    }
    public void check() {
        if (cancelled.get() || Thread.currentThread().isInterrupted()) throw new LlmException(LlmException.Code.CANCELLED);
    }
    public AutoCloseable onCancel(Runnable listener) {
        listeners.add(listener);
        if (cancelled.get()) listener.run();
        return () -> listeners.remove(listener);
    }
}
