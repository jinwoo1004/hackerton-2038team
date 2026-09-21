package com.xisnd.monitoring.config;

import com.xisnd.monitoring.alert.AlertProperties;
import java.util.concurrent.Executor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class SchedulingConfig {

    @Bean(name = "alertExecutor")
    public Executor alertExecutor(AlertProperties properties) {
        if (!properties.async()) {
            return new SyncTaskExecutor();
        }
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("alert-");
        executor.initialize();
        return executor;
    }

    @Configuration
    @EnableScheduling
    @ConditionalOnProperty(prefix = "app.scheduling", name = "enabled", havingValue = "true", matchIfMissing = true)
    static class Enabled {
    }
}
