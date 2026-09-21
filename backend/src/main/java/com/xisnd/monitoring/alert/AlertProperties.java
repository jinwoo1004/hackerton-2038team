package com.xisnd.monitoring.alert;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.alerts")
public record AlertProperties(
        @DefaultValue("true") boolean async,
        @DefaultValue("10") int dedupMinutes,
        @DefaultValue("https://hooks.slack.com/services/") List<String> slackAllowedPrefixes,
        String publicUrl) {
}
