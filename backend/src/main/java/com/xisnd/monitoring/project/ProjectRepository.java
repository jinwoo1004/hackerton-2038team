package com.xisnd.monitoring.project;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    @EntityGraph(attributePaths = "technologies")
    List<Project> findByCreatedByOrderByCreatedAtDesc(Long createdBy);

    @EntityGraph(attributePaths = "technologies")
    Optional<Project> findWithTechnologiesById(Long id);

    boolean existsByProjectCodeIgnoreCase(String projectCode);
}
