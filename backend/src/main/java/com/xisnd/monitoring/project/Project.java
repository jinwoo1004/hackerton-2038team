package com.xisnd.monitoring.project;

import com.xisnd.monitoring.common.BaseTimeEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Getter
@Entity
@Table(name = "project")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Project extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 40)
    private String projectCode;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 120)
    private String nickname;

    @Column(length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private ProjectStatus status;

    @Column(nullable = false)
    private Long createdBy;

    private LocalDateTime lastAnalyzedAt;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private final List<ProjectTechnology> technologies = new ArrayList<>();

    @Builder
    public Project(String projectCode, String name, String nickname, String description, Long createdBy) {
        this.projectCode = projectCode;
        this.name = name;
        this.nickname = nickname;
        this.description = description;
        this.createdBy = createdBy;
        this.status = ProjectStatus.READY;
    }

    public void updateBasics(String name, String nickname, String description) {
        if (name != null && !name.isBlank()) {
            this.name = name;
        }
        this.nickname = nickname;
        this.description = description;
    }

    public void replaceTechnologies(List<TechnologyValue> values) {
        this.technologies.clear();
        if (values == null) {
            return;
        }
        values.stream()
                .filter(v -> v.name() != null && !v.name().isBlank())
                .forEach(v -> this.technologies.add(new ProjectTechnology(this, v.category(), v.name().trim())));
    }

    public void changeStatus(ProjectStatus status) {
        this.status = status;
    }

    public void markAnalyzed(LocalDateTime at) {
        this.lastAnalyzedAt = at;
    }

    public record TechnologyValue(TechCategory category, String name) {
    }
}
