package com.xisnd.monitoring.alert;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertRuleRepository extends JpaRepository<AlertRule, Long> {

    List<AlertRule> findByUserIdOrderByCreatedAtAsc(Long userId);

    List<AlertRule> findByUserIdAndEnabledTrue(Long userId);

    Optional<AlertRule> findByIdAndUserId(Long id, Long userId);

    void deleteByChannelId(Long channelId);

    void deleteByProjectId(Long projectId);

    long countByUserId(Long userId);
}
