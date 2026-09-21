package com.xisnd.monitoring.config;

import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import java.io.IOException;
import java.net.HttpURLConnection;

/** Apply only to the dedicated internal analysis client, never to third-party requests. */
public final class AnalysisAuthentication {
    private AnalysisAuthentication() { }
    public static SimpleClientHttpRequestFactory requestFactory() {
        return new SimpleClientHttpRequestFactory() {
            @Override protected void prepareConnection(HttpURLConnection connection, String method) throws IOException {
                super.prepareConnection(connection, method);
                // Never forward the internal credential to a redirected destination.
                connection.setInstanceFollowRedirects(false);
            }
        };
    }
    public static RestTemplate configure(RestTemplate client, AnalysisServiceProperties properties) {
        if (!properties.sharedSecret().isBlank()) {
            client.getInterceptors().add((request, body, execution) -> {
                request.getHeaders().set("X-Analysis-Token", properties.sharedSecret());
                return execution.execute(request, body);
            });
        }
        return client;
    }
}
