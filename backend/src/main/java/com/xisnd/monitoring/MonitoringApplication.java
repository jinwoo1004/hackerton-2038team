package com.xisnd.monitoring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

// 기본 인메모리 사용자 비활성화
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@ConfigurationPropertiesScan
@EnableJpaAuditing
public class MonitoringApplication {

    public static void main(String[] args) {
        try {
            com.xisnd.monitoring.llm.LlmSettings.load(System::getenv, com.xisnd.monitoring.llm.LlmFactory.repositoryRoot());
        } catch (com.xisnd.monitoring.llm.LlmException error) {
            System.err.println("AI configuration [" + error.code().name() + "]: " + error.getMessage());
            System.exit(error.code().exitCode());
            return;
        }
        SpringApplication application = new SpringApplication(MonitoringApplication.class);
        application.addInitializers(new com.xisnd.monitoring.config.DeploymentConfiguration());
        application.run(args);
    }
}
