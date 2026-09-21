package com.xisnd.monitoring.file;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectFileRepository extends JpaRepository<ProjectFile, Long> {

    List<ProjectFile> findByProjectIdOrderByCreatedAtAsc(Long projectId);

    Optional<ProjectFile> findByIdAndProjectId(Long id, Long projectId);

    long countByProjectId(Long projectId);

    void deleteByProjectId(Long projectId);
}
