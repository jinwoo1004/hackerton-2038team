package com.xisnd.monitoring.llm;

import java.io.ByteArrayOutputStream;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.Flow;

/** A deadline covers receipt of the entire body, including a server that trickles bytes indefinitely. */
public final class JdkLlmTransport implements LlmTransport {
    static final int MAX_RESPONSE_BYTES = 1024 * 1024;
    private final HttpClient client;
    public JdkLlmTransport() {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build());
    }
    JdkLlmTransport(HttpClient client) {
        if (client.followRedirects() != HttpClient.Redirect.NEVER) throw new LlmException(LlmException.Code.CONFIG_INVALID);
        this.client = client;
    }
    @Override public Response exchange(Request request, Duration deadline, LlmCancellation cancellation) {
        cancellation.check();
        if (!request.uri().equals(CodexOAuthProvider.ENDPOINT) && !request.uri().equals(OpenAiApiProvider.ENDPOINT))
            throw new LlmException(LlmException.Code.CONFIG_INVALID);
        BoundedBody body = new BoundedBody();
        CompletableFuture<HttpResponse<byte[]>> future = null;
        AutoCloseable hook = null;
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(request.uri()).timeout(deadline)
                .POST(HttpRequest.BodyPublishers.ofByteArray(request.body()));
            request.headers().forEach(builder::header);
            future = client.sendAsync(builder.build(), info -> {
                body.sse = request.uri().equals(CodexOAuthProvider.ENDPOINT) && info.statusCode() == 200;
                return body;
            });
            CompletableFuture<HttpResponse<byte[]>> exchange = future;
            hook = cancellation.onCancel(() -> { body.cancel(LlmException.Code.CANCELLED); exchange.cancel(true); });
            HttpResponse<byte[]> response = future.get(Math.max(1, deadline.toMillis()), TimeUnit.MILLISECONDS);
            cancellation.check();
            return new Response(response.statusCode(), response.headers().firstValue("Content-Type").orElse(""), response.body());
        } catch (TimeoutException ignored) {
            body.cancel(LlmException.Code.TIMEOUT);
            throw new LlmException(LlmException.Code.TIMEOUT);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
            body.cancel(LlmException.Code.CANCELLED);
            throw new LlmException(LlmException.Code.CANCELLED);
        } catch (CancellationException ignored) {
            throw new LlmException(LlmException.Code.CANCELLED);
        } catch (ExecutionException ex) {
            Throwable cause = ex.getCause();
            if (cause instanceof LlmException failure) throw failure;
            if (cause instanceof java.net.http.HttpTimeoutException) throw new LlmException(LlmException.Code.TIMEOUT);
            throw new LlmException(LlmException.Code.TRANSPORT_ERROR);
        } catch (LlmException ex) { throw ex; }
        catch (Exception ignored) { throw new LlmException(LlmException.Code.TRANSPORT_ERROR); }
        finally {
            if (future != null && !future.isDone()) future.cancel(true);
            body.close();
            if (hook != null) try { hook.close(); } catch (Exception ignored) { }
        }
    }

    private static final class BoundedBody implements HttpResponse.BodySubscriber<byte[]> {
        private final CompletableFuture<byte[]> completed = new CompletableFuture<>();
        private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        private final TerminalFrame terminal = new TerminalFrame();
        private boolean sse;
        private volatile Flow.Subscription subscription;
        @Override public CompletionStage<byte[]> getBody() { return completed; }
        @Override public void onSubscribe(Flow.Subscription subscription) {
            this.subscription = subscription;
            if (completed.isDone()) subscription.cancel(); else subscription.request(Long.MAX_VALUE);
        }
        @Override public void onNext(List<ByteBuffer> chunks) {
            if (completed.isDone()) return;
            for (ByteBuffer chunk : chunks) {
                int capacity = MAX_RESPONSE_BYTES - bytes.size();
                byte[] part = new byte[Math.min(chunk.remaining(), capacity + 1)]; chunk.get(part);
                int consumed = sse ? terminal.accept(part) : part.length;
                if (consumed > capacity) { cancel(LlmException.Code.RESPONSE_TOO_LARGE); return; }
                bytes.write(part, 0, consumed);
                // Stop at the delimiter itself. Trailing bytes may be an unfinished UTF-8
                // codepoint or another frame and must not make success depend on chunking.
                if (sse && terminal.found) { completed.complete(bytes.toByteArray()); close(); return; }
            }
        }
        @Override public void onError(Throwable ignored) { completed.completeExceptionally(new LlmException(LlmException.Code.TRANSPORT_ERROR)); }
        @Override public void onComplete() { completed.complete(bytes.toByteArray()); }
        void cancel(LlmException.Code reason) { completed.completeExceptionally(new LlmException(reason)); close(); }
        void close() { if (subscription != null) subscription.cancel(); }
    }

    /** Finds complete SSE frames byte by byte without splitting or repeatedly decoding UTF-8. */
    private static final class TerminalFrame {
        private final ByteArrayOutputStream line = new ByteArrayOutputStream();
        private final StringBuilder data = new StringBuilder();
        private boolean afterCr, firstLine = true, found;
        int accept(byte[] bytes) {
            for (int index = 0; index < bytes.length; index++) {
                byte value = bytes[index];
                if (afterCr) { afterCr = false; if (value == '\n') continue; }
                if (value == '\r') { endLine(); afterCr = true; }
                else if (value == '\n') endLine();
                else line.write(value);
                if (found) return index + 1;
            }
            return bytes.length;
        }
        private void endLine() {
            String text = line.toString(StandardCharsets.UTF_8); line.reset();
            if (firstLine && text.startsWith("\uFEFF")) text = text.substring(1);
            firstLine = false;
            if (text.isEmpty()) {
                if (data.length() == 0) return;
                String payload = data.substring(0, data.length() - 1); data.setLength(0);
                if (payload.equals("[DONE]")) { found = true; return; }
                try {
                    String type = LlmResponses.json(payload).path("type").asText();
                    if (type.equals("response.completed") || type.equals("response.failed") || type.equals("response.incomplete") || type.equals("error")) found = true;
                } catch (LlmException ignored) { found = true; } // Main parser returns the safe error.
            } else if (text.equals("data") || text.startsWith("data:")) {
                String value = text.length() == 4 ? "" : text.substring(5);
                if (value.startsWith(" ")) value = value.substring(1);
                data.append(value).append('\n');
            }
        }
    }
}
