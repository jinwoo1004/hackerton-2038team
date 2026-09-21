package com.xisnd.monitoring.incident;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.detection")
public record DetectionProperties(
        @DefaultValue("true") boolean enabled,
        @DefaultValue("5") int windowMinutes,
        @DefaultValue("90") double cpuWarn,
        @DefaultValue("97") double cpuCritical,
        @DefaultValue("90") double memoryWarn,
        @DefaultValue("97") double memoryCritical,
        @DefaultValue("90") double diskWarn,
        @DefaultValue("95") double diskCritical,
        @DefaultValue("20") int errorBurst,
        @DefaultValue("100") int errorBurstCritical,
        @DefaultValue("10") int fatalQuietMinutes,
        @DefaultValue("30") int newErrorHoldMinutes,
        @DefaultValue("true") boolean statistical) {
}
