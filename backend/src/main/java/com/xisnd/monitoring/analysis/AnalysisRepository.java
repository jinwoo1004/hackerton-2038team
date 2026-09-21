package com.xisnd.monitoring.analysis;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalysisRepository extends JpaRepository<Analysis, Long> {

    List<Analysis> findByProjectIdOrderByCreatedAtDesc(Long projectId);

    Optional<Analysis> findFirstByProjectIdOrderByCreatedAtDesc(Long projectId);

    void deleteByProjectId(Long projectId);

    List<Analysis> findByStatusIn(Collection<AnalysisStatus> statuses);

    List<Analysis> findByProjectIdInOrderByCreatedAtDesc(Collection<Long> projectIds, Pageable pageable);

    Optional<Analysis> findFirstByProjectIdAndStatusOrderByCreatedAtDesc(Long projectId, AnalysisStatus status);

    long countByProjectIdIn(Collection<Long> projectIds);

    long countByProjectIdInAndStatusIn(Collection<Long> projectIds, Collection<AnalysisStatus> statuses);
}
