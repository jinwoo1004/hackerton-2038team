package com.xisnd.monitoring.llm;

import java.net.URI;
import java.time.Duration;
import java.util.Map;

/** Injectable transport for offline tests. Production adapters always supply fixed HTTPS endpoints. */
public interface LlmTransport {
    Response exchange(Request request, Duration deadline, LlmCancellation cancellation);
    record Request(URI uri, Map<String, String> headers, byte[] body) {
        @Override public String toString() { return "LlmRequest[redacted]"; }
    }
    record Response(int status, String contentType, byte[] body) {
        @Override public String toString() { return "LlmResponse[redacted]"; }
    }
}
