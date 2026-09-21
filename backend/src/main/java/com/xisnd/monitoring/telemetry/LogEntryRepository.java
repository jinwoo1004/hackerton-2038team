package com.xisnd.monitoring.telemetry;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LogEntryRepository extends JpaRepository<LogEntry, Long> {

    @Query("""
            select e from LogEntry e
            where e.projectId = :projectId
              and (:agentId is null or e.agentId = :agentId)
              and e.level in :levels
              and (:query is null or lower(e.message) like :query)
              and (:afterId is null or e.id > :afterId)
            order by e.id desc
            """)
    List<LogEntry> search(@Param("projectId") Long projectId, @Param("agentId") Long agentId,
                          @Param("levels") Collection<LogLevel> levels, @Param("query") String query,
                          @Param("afterId") Long afterId, Pageable pageable);

    @Query("""
            select e.level, count(e) from LogEntry e
            where e.projectId = :projectId and e.loggedAt >= :from
            group by e.level
            """)
    List<Object[]> countByLevel(@Param("projectId") Long projectId, @Param("from") LocalDateTime from);

    @Query("""
            select e.loggedAt from LogEntry e
            where e.projectId = :projectId and e.level in :levels and e.loggedAt >= :from
            """)
    List<LocalDateTime> timesOf(@Param("projectId") Long projectId, @Param("levels") Collection<LogLevel> levels,
                                @Param("from") LocalDateTime from, Pageable pageable);

    @Query("""
            select e from LogEntry e
            where e.projectId = :projectId and e.level in :levels and e.receivedAt >= :from
            order by e.id desc
            """)
    List<LogEntry> receivedSince(@Param("projectId") Long projectId, @Param("levels") Collection<LogLevel> levels,
                                 @Param("from") LocalDateTime from, Pageable pageable);

    boolean existsByProjectIdAndFingerprintAndLoggedAtBefore(Long projectId, String fingerprint, LocalDateTime before);

    Optional<LogEntry> findFirstByProjectIdOrderByLoggedAtAsc(Long projectId);

    long countByProjectIdAndLevelInAndLoggedAtAfter(Long projectId, Collection<LogLevel> levels, LocalDateTime after);

    @Modifying
    @Query("delete from LogEntry e where e.loggedAt < :before")
    int deleteOlderThan(@Param("before") LocalDateTime before);

    @Modifying
    @Query("delete from LogEntry e where e.agentId = :agentId")
    int deleteByAgent(@Param("agentId") Long agentId);

    @Modifying
    @Query("delete from LogEntry e where e.projectId = :projectId")
    int deleteByProject(@Param("projectId") Long projectId);
}
