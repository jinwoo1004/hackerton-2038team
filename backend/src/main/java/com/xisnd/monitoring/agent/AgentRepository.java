package com.xisnd.monitoring.agent;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AgentRepository extends JpaRepository<Agent, Long> {

    Optional<Agent> findByTokenHash(String tokenHash);

    List<Agent> findByProjectIdOrderByCreatedAtAsc(Long projectId);

    List<Agent> findByProjectIdInOrderByCreatedAtAsc(Collection<Long> projectIds);

    List<Agent> findByConnectedTrueAndLastSeenAtBefore(LocalDateTime before);

    long countByProjectId(Long projectId);

    void deleteByProjectId(Long projectId);
}
