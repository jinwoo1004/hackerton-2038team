package com.xisnd.monitoring.telemetry;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MetricPointRepository extends JpaRepository<MetricPoint, Long> {

    List<MetricPoint> findByProjectIdAndCollectedAtAfterOrderByCollectedAtAsc(Long projectId, LocalDateTime after);

    List<MetricPoint> findByAgentIdAndCollectedAtAfterOrderByCollectedAtAsc(Long agentId, LocalDateTime after);

    Optional<MetricPoint> findFirstByAgentIdOrderByCollectedAtDesc(Long agentId);

    @Modifying
    @Query("delete from MetricPoint m where m.collectedAt < :before")
    int deleteOlderThan(@Param("before") LocalDateTime before);

    @Modifying
    @Query("delete from MetricPoint m where m.agentId = :agentId")
    int deleteByAgent(@Param("agentId") Long agentId);

    @Modifying
    @Query("delete from MetricPoint m where m.projectId = :projectId")
    int deleteByProject(@Param("projectId") Long projectId);
}
