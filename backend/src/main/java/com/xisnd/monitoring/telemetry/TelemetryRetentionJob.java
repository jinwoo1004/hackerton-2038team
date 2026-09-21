package com.xisnd.monitoring.telemetry;

import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class TelemetryRetentionJob {

    private final LogEntryRepository logRepository;
    private final MetricPointRepository metricRepository;

    @Value("${app.telemetry.log-retention-days:14}")
    private int logDays;

    @Value("${app.telemetry.metric-retention-days:30}")
    private int metricDays;

    @Scheduled(cron = "${app.telemetry.retention-cron:0 30 3 * * *}")
    @Transactional
    public void purge() {
        LocalDateTime now = LocalDateTime.now();
        int logs = logRepository.deleteOlderThan(now.minusDays(logDays));
        int metrics = metricRepository.deleteOlderThan(now.minusDays(metricDays));
        if (logs + metrics > 0) {
            log.info("오래된 수집 데이터 정리: 로그 {}건, 지표 {}건", logs, metrics);
        }
    }
}
