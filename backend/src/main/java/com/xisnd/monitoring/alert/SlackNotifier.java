package com.xisnd.monitoring.alert;

import com.xisnd.monitoring.common.ApiException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Component
public class SlackNotifier {

    private final AlertProperties properties;
    private final RestTemplate restTemplate;

    public SlackNotifier(AlertProperties properties) {
        this.properties = properties;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        // 사내 프록시가 chunked 요청을 막는 경우가 있어 Content-Length 를 붙여 보낸다
        this.restTemplate = new RestTemplate(new BufferingClientHttpRequestFactory(factory));
    }

    public void validate(String url) {
        String value = url == null ? "" : url.trim();
        boolean allowed = properties.slackAllowedPrefixes().stream().anyMatch(value::startsWith);
        if (!allowed || value.length() > 500) {
            throw ApiException.badRequest("Slack Incoming Webhook 주소(https://hooks.slack.com/services/...)를 입력해주세요.");
        }
    }

    public Optional<String> send(String url, AlertMessage message) {
        try {
            validate(url);
            restTemplate.postForObject(url, payload(message), String.class);
            return Optional.empty();
        } catch (ApiException e) {
            return Optional.of(e.getMessage());
        } catch (HttpStatusCodeException e) {
            String body = e.getResponseBodyAsString();
            return Optional.of("Slack 응답 " + e.getStatusCode().value() + (body.isBlank() ? "" : " " + body));
        } catch (RestClientException e) {
            return Optional.of("Slack 연결 실패: " + e.getMessage());
        }
    }

    Map<String, Object> payload(AlertMessage m) {
        List<Map<String, Object>> blocks = new ArrayList<>();
        blocks.add(Map.of("type", "section", "text", mrkdwn("*" + escape(m.headline()) + "*")));

        List<Map<String, Object>> fields = new ArrayList<>();
        m.fields().forEach((label, value) -> fields.add(mrkdwn("*" + escape(label) + "*\n" + escape(value))));
        if (!fields.isEmpty()) {
            blocks.add(Map.of("type", "section", "fields", fields));
        }
        if (m.detail() != null && !m.detail().isBlank()) {
            blocks.add(Map.of("type", "section", "text", mrkdwn("```" + m.detail().replace("```", "'''") + "```")));
        }
        String footer = m.link() == null ? m.footer() : m.footer() + "  |  <" + m.link() + "|플랫폼에서 보기>";
        blocks.add(Map.of("type", "context", "elements", List.of(mrkdwn(footer))));
        return Map.of("text", m.headline(), "blocks", blocks);
    }

    private static Map<String, Object> mrkdwn(String text) {
        return Map.of("type", "mrkdwn", "text", text);
    }

    private static String escape(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    public record AlertMessage(String headline, Map<String, String> fields, String detail, String footer, String link) {
    }
}
