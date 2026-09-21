package com.xisnd.monitoring.llm;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LlmConfiguration {
    @Bean public LlmSettings llmSettings() {
        // Uppercase process environment is authoritative; Spring aliases/CLI overrides cannot select a paid provider.
        return LlmSettings.load(System::getenv, LlmFactory.repositoryRoot());
    }
    @Bean public StructuredLlm structuredLlm(LlmSettings settings) { return LlmFactory.create(settings, new JdkLlmTransport()); }
}
