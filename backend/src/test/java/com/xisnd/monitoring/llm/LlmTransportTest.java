package com.xisnd.monitoring.llm;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static com.xisnd.monitoring.llm.LlmProviderBoundaryTest.*;
import java.net.URI;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.jupiter.api.Test;

/** The HttpClient is synthetic: exercises JDK BodySubscriber behavior with zero sockets. */
class LlmTransportTest {
    private static LlmTransport.Request request() { return new LlmTransport.Request(CodexOAuthProvider.ENDPOINT, Map.of("User-Agent", "monitoring-platform/1.0"), "{}".getBytes(StandardCharsets.UTF_8)); }

    @Test void every_utf8_and_sse_boundary_can_split_into_single_byte_chunks() throws Exception {
        byte[] stream = completed("{\"message\":\"안녕 세계 🌍\"}").replace("\n", "\r\n").getBytes(StandardCharsets.UTF_8);
        List<byte[]> chunks = new ArrayList<>(); for (byte value : stream) chunks.add(new byte[]{value});
        try (SyntheticHttp fake = new SyntheticHttp(chunks, 0)) {
            var response = new JdkLlmTransport(fake.client).exchange(request(), Duration.ofSeconds(2), new LlmCancellation());
            var result = LlmResponses.parse(response, true, StructuredLlm.objectSchema(Map.of("message", Map.of("type", "string"))), new LlmCancellation());
            assertThat(result.path("message").asText()).isEqualTo("안녕 세계 🌍");
            assertThat(fake.closed.get()).isTrue();
        }
    }

    @Test void completed_sse_frame_finishes_and_cancels_without_waiting_for_http_eof() throws Exception {
        byte[] stream = completed("{\"ok\":true}").getBytes(StandardCharsets.UTF_8);
        try (SyntheticHttp fake = new SyntheticHttp(List.of(stream), 0, false)) {
            var response = new JdkLlmTransport(fake.client).exchange(request(), Duration.ofSeconds(1), new LlmCancellation());
            assertThat(LlmResponses.parse(response, true, SCHEMA, new LlmCancellation()).path("ok").asBoolean()).isTrue();
            assertThat(fake.closed.get()).isTrue();
        }
    }

    @Test void terminal_failure_closes_open_http_stream_and_missing_blank_boundary_does_not_complete() throws Exception {
        String failed = "data: {\"type\":\"response.failed\",\"response\":{\"error\":{\"code\":\"rate_limit_exceeded\"}}}\n\n";
        try (SyntheticHttp fake = new SyntheticHttp(List.of(failed.getBytes(StandardCharsets.UTF_8)), 0, false)) {
            var response = new JdkLlmTransport(fake.client).exchange(request(), Duration.ofSeconds(1), new LlmCancellation());
            assertCode(() -> LlmResponses.parse(response, true, SCHEMA, new LlmCancellation()), LlmException.Code.RATE_LIMITED);
            assertThat(fake.closed.get()).isTrue();
        }
        try (SyntheticHttp fake = new SyntheticHttp(List.of((completed("{\"ok\":true}").stripTrailing() + "\r").getBytes(StandardCharsets.UTF_8)), 0, false)) {
            assertCode(() -> new JdkLlmTransport(fake.client).exchange(request(), Duration.ofMillis(100), new LlmCancellation()), LlmException.Code.TIMEOUT);
            assertThat(fake.closed.get()).isTrue();
        }
    }

    @Test void terminal_boundary_ignores_partial_next_frame_or_utf8_in_same_delivery() throws Exception {
        byte[] complete = completed("{\"ok\":true}").getBytes(StandardCharsets.UTF_8);
        for (byte[] suffix : List.of("data: {\"type\":\"response.".getBytes(StandardCharsets.UTF_8), new byte[]{(byte) 0xf0, (byte) 0x9f})) {
            byte[] merged = Arrays.copyOf(complete, complete.length + suffix.length);
            System.arraycopy(suffix, 0, merged, complete.length, suffix.length);
            for (boolean multipleBuffers : List.of(false, true)) {
                List<byte[]> delivery = multipleBuffers ? List.of(complete, suffix) : List.of(merged);
                try (SyntheticHttp fake = new SyntheticHttp(delivery, 0, false, true)) {
                    var response = new JdkLlmTransport(fake.client).exchange(request(), Duration.ofSeconds(1), new LlmCancellation());
                    assertThat(response.body()).isEqualTo(complete);
                    assertThat(LlmResponses.parse(response, true, SCHEMA, new LlmCancellation()).path("ok").asBoolean()).isTrue();
                    assertThat(fake.closed.get()).isTrue();
                }
            }
        }
    }

    @Test void whole_deadline_cancels_a_slow_body_even_after_headers_arrive() throws Exception {
        try (SyntheticHttp fake = new SyntheticHttp(Collections.nCopies(100, new byte[]{'x'}), 25)) {
            long start = System.nanoTime();
            assertCode(() -> new JdkLlmTransport(fake.client).exchange(request(), Duration.ofMillis(100), new LlmCancellation()), LlmException.Code.TIMEOUT);
            assertThat(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start)).isLessThan(2000);
            assertThat(fake.closed.get()).isTrue();
        }
    }

    @Test void external_cancellation_closes_subscription_and_waiting_request() throws Exception {
        try (SyntheticHttp fake = new SyntheticHttp(Collections.nCopies(100, new byte[]{'x'}), 25)) {
            var cancellation = new LlmCancellation();
            ExecutorService worker = Executors.newSingleThreadExecutor();
            try {
                Future<LlmException.Code> result = worker.submit(() -> {
                    try { new JdkLlmTransport(fake.client).exchange(request(), Duration.ofSeconds(5), cancellation); return null; }
                    catch (LlmException error) { return error.code(); }
                });
                assertThat(fake.firstChunk.await(1, TimeUnit.SECONDS)).isTrue();
                cancellation.cancel();
                assertThat(result.get(2, TimeUnit.SECONDS)).isEqualTo(LlmException.Code.CANCELLED);
                assertThat(fake.closed.get()).isTrue();
            } finally { worker.shutdownNow(); }
        }
    }

    @Test void interruption_preserves_interrupt_flag_and_closes_body() throws Exception {
        try (SyntheticHttp fake = new SyntheticHttp(Collections.nCopies(100, new byte[]{'x'}), 25)) {
            AtomicReference<LlmException.Code> errorCode = new AtomicReference<>(); AtomicBoolean interrupted = new AtomicBoolean();
            Thread caller = new Thread(() -> {
                try { new JdkLlmTransport(fake.client).exchange(request(), Duration.ofSeconds(5), new LlmCancellation()); }
                catch (LlmException error) { errorCode.set(error.code()); interrupted.set(Thread.currentThread().isInterrupted()); }
            });
            caller.start(); assertThat(fake.firstChunk.await(1, TimeUnit.SECONDS)).isTrue(); caller.interrupt(); caller.join(2000);
            assertThat(caller.isAlive()).isFalse(); assertThat(errorCode.get()).isEqualTo(LlmException.Code.CANCELLED);
            assertThat(interrupted.get()).isTrue(); assertThat(fake.closed.get()).isTrue();
        }
    }

    @Test void oversized_body_is_rejected_and_cancelled() throws Exception {
        try (SyntheticHttp fake = new SyntheticHttp(List.of(new byte[JdkLlmTransport.MAX_RESPONSE_BYTES + 1]), 0)) {
            assertCode(() -> new JdkLlmTransport(fake.client).exchange(request(), Duration.ofSeconds(2), new LlmCancellation()), LlmException.Code.RESPONSE_TOO_LARGE);
            assertThat(fake.closed.get()).isTrue();
        }
    }

    @Test void redirect_clients_and_non_allowlisted_endpoints_are_rejected_before_send() throws Exception {
        HttpClient redirecting = mock(HttpClient.class); when(redirecting.followRedirects()).thenReturn(HttpClient.Redirect.ALWAYS);
        assertCode(() -> new JdkLlmTransport(redirecting), LlmException.Code.CONFIG_INVALID);
        try (SyntheticHttp fake = new SyntheticHttp(List.of(), 0)) {
            var redirected = new LlmTransport.Request(URI.create("https://untrusted.invalid/responses"), Map.of(), new byte[0]);
            assertCode(() -> new JdkLlmTransport(fake.client).exchange(redirected, Duration.ofSeconds(1), new LlmCancellation()), LlmException.Code.CONFIG_INVALID);
            var cancelled = new LlmCancellation(); cancelled.cancel();
            assertCode(() -> new JdkLlmTransport(fake.client).exchange(request(), Duration.ofSeconds(1), cancelled), LlmException.Code.CANCELLED);
            verify(fake.client, never()).sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
        }
    }

    @Test void deadline_also_cancels_a_request_that_never_receives_headers() {
        HttpClient client = mock(HttpClient.class); when(client.followRedirects()).thenReturn(HttpClient.Redirect.NEVER);
        CompletableFuture<HttpResponse<Object>> pending = new CompletableFuture<>();
        when(client.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(pending);
        assertCode(() -> new JdkLlmTransport(client).exchange(request(), Duration.ofMillis(50), new LlmCancellation()), LlmException.Code.TIMEOUT);
        assertThat(pending.isCancelled()).isTrue();
    }

    private static final class SyntheticHttp implements AutoCloseable {
        final HttpClient client = mock(HttpClient.class);
        final AtomicBoolean closed = new AtomicBoolean();
        final CountDownLatch firstChunk = new CountDownLatch(1);
        final ExecutorService delivery = Executors.newSingleThreadExecutor();
        SyntheticHttp(List<byte[]> chunks, int delayMs) { this(chunks, delayMs, true); }
        SyntheticHttp(List<byte[]> chunks, int delayMs, boolean endStream) { this(chunks, delayMs, endStream, false); }
        @SuppressWarnings({"unchecked", "rawtypes"})
        SyntheticHttp(List<byte[]> chunks, int delayMs, boolean endStream, boolean oneDelivery) {
            when(client.followRedirects()).thenReturn(HttpClient.Redirect.NEVER);
            when(client.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenAnswer(invocation -> {
                HttpResponse.BodyHandler<byte[]> handler = invocation.getArgument(1);
                HttpResponse.ResponseInfo info = mock(HttpResponse.ResponseInfo.class);
                when(info.statusCode()).thenReturn(200);
                HttpResponse.BodySubscriber<byte[]> subscriber = handler.apply(info);
                CompletableFuture<HttpResponse<byte[]>> result = subscriber.getBody().toCompletableFuture().thenApply(bytes -> {
                    HttpResponse<byte[]> response = mock(HttpResponse.class);
                    when(response.statusCode()).thenReturn(200); when(response.body()).thenReturn(bytes);
                    when(response.headers()).thenReturn(HttpHeaders.of(Map.of("Content-Type", List.of("text/event-stream")), (a,b) -> true));
                    return response;
                });
                subscriber.onSubscribe(new Flow.Subscription() {
                    final AtomicBoolean started = new AtomicBoolean();
                    public void request(long count) {
                        if (!started.compareAndSet(false, true)) return;
                        delivery.submit(() -> {
                            try {
                                if (oneDelivery) {
                                    subscriber.onNext(chunks.stream().map(ByteBuffer::wrap).toList()); firstChunk.countDown();
                                    if (endStream && !closed.get()) subscriber.onComplete();
                                    return;
                                }
                                for (byte[] chunk : chunks) {
                                    if (closed.get()) return;
                                    subscriber.onNext(List.of(ByteBuffer.wrap(chunk))); firstChunk.countDown();
                                    if (delayMs > 0) Thread.sleep(delayMs);
                                }
                                if (endStream && !closed.get()) subscriber.onComplete();
                            } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                        });
                    }
                    public void cancel() { closed.set(true); }
                });
                return result;
            });
        }
        public void close() { closed.set(true); delivery.shutdownNow(); }
    }
}
