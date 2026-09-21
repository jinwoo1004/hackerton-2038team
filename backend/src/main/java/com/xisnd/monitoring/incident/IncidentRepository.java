package com.xisnd.monitoring.incident;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface IncidentRepository extends JpaRepository<Incident, Long> {

    Optional<Incident> findFirstByDedupKeyAndStatus(String dedupKey, IncidentStatus status);

    List<Incident> findByProjectIdAndStatus(Long projectId, IncidentStatus status);

    List<Incident> findByAgentIdAndStatus(Long agentId, IncidentStatus status);

    long countByProjectIdAndStatus(Long projectId, IncidentStatus status);

    long countByProjectIdInAndStatus(Collection<Long> projectIds, IncidentStatus status);

    @Query("""
            select i from Incident i
            where i.projectId in :projectIds
              and (:status is null or i.status = :status)
            order by i.lastDetectedAt desc, i.id desc
            """)
    List<Incident> search(@Param("projectIds") Collection<Long> projectIds, @Param("status") IncidentStatus status,
                          Pageable pageable);

    @Modifying
    @Query("delete from Incident i where i.projectId = :projectId")
    int deleteByProject(@Param("projectId") Long projectId);
}
