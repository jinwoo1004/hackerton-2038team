package com.xisnd.monitoring.ingest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xisnd.monitoring.common.ErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.Enumeration;
import java.util.zip.GZIPInputStream;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@RequiredArgsConstructor
public class GzipRequestFilter extends OncePerRequestFilter {

    static final long MAX_BODY = 5L * 1024 * 1024;
    static final long MAX_INFLATED = 32L * 1024 * 1024;

    private final ObjectMapper objectMapper;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/ingest/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getContentLengthLong() > MAX_BODY) {
            reject(response);
            return;
        }
        String encoding = request.getHeader("Content-Encoding");
        boolean gzip = encoding != null && encoding.toLowerCase().contains("gzip");
        chain.doFilter(new LimitedRequest(request, gzip), response);
    }

    private void reject(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.PAYLOAD_TOO_LARGE.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(),
                ErrorResponse.of(HttpStatus.PAYLOAD_TOO_LARGE.value(), "요청 크기가 너무 큽니다."));
    }

    private static final class LimitedRequest extends HttpServletRequestWrapper {

        private final HttpServletRequest original;
        private final boolean gzip;
        private final long limit;

        LimitedRequest(HttpServletRequest request, boolean gzip) {
            super(request);
            this.original = request;
            this.gzip = gzip;
            this.limit = gzip ? MAX_INFLATED : MAX_BODY;
        }

        @Override
        public ServletInputStream getInputStream() throws IOException {
            InputStream in = gzip ? new GZIPInputStream(original.getInputStream()) : original.getInputStream();
            return new ServletInputStream() {
                private long read;

                @Override
                public int read() throws IOException {
                    int b = in.read();
                    if (b >= 0 && ++read > limit) {
                        throw new IOException("요청 크기 초과");
                    }
                    return b;
                }

                @Override
                public int read(byte[] buf, int off, int len) throws IOException {
                    int n = in.read(buf, off, len);
                    if (n > 0 && (read += n) > limit) {
                        throw new IOException("요청 크기 초과");
                    }
                    return n;
                }

                @Override
                public boolean isFinished() {
                    try {
                        return in.available() == 0;
                    } catch (IOException e) {
                        return true;
                    }
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException();
                }
            };
        }

        @Override
        public String getHeader(String name) {
            if (gzip && "Content-Encoding".equalsIgnoreCase(name)) {
                return null;
            }
            return super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            if (gzip && "Content-Encoding".equalsIgnoreCase(name)) {
                return Collections.emptyEnumeration();
            }
            return super.getHeaders(name);
        }

        @Override
        public int getContentLength() {
            return gzip ? -1 : super.getContentLength();
        }

        @Override
        public long getContentLengthLong() {
            return gzip ? -1 : super.getContentLengthLong();
        }
    }
}
