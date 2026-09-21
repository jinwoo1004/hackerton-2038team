package com.xisnd.monitoring.event;

import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ActivityEventRepository extends JpaRepository<ActivityEvent, Long> {

    @Query("""
            select e from ActivityEvent e
            where e.userId = :userId
              and (:projectId is null or e.projectId = :projectId)
              and (:level is null or e.level = :level)
              and (:since is null or e.createdAt >= :since)
              and (:q is null or lower(e.title) like :q escape '\\' or lower(e.message) like :q escape '\\' or lower(e.projectName) like :q escape '\\')
            """)
    Page<ActivityEvent> search(@Param("userId") Long userId, @Param("projectId") Long projectId,
                               @Param("level") EventLevel level, @Param("since") LocalDateTime since,
                               @Param("q") String q, Pageable pageable);

    @Query("""
            select e.level, count(e) from ActivityEvent e
            where e.userId = :userId
              and (:projectId is null or e.projectId = :projectId)
              and (:since is null or e.createdAt >= :since)
              and (:q is null or lower(e.title) like :q escape '\\' or lower(e.message) like :q escape '\\' or lower(e.projectName) like :q escape '\\')
            group by e.level
            """)
    List<Object[]> countByLevel(@Param("userId") Long userId, @Param("projectId") Long projectId,
                                @Param("since") LocalDateTime since, @Param("q") String q);

    @Query("""
            select count(e) from ActivityEvent e
            where e.userId = :userId
              and (:projectId is null or e.projectId = :projectId)
              and e.createdAt >= :from and e.createdAt < :to
            """)
    long countBetween(@Param("userId") Long userId, @Param("projectId") Long projectId,
                      @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    long countByProjectIdAndCreatedAtAfter(Long projectId, LocalDateTime after);
}
