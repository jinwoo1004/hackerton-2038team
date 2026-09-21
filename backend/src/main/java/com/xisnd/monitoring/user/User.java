package com.xisnd.monitoring.user;

import com.xisnd.monitoring.common.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Getter
@Entity
@Table(name = "users")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 190)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(length = 120)
    private String company;

    @Column(length = 120)
    private String department;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private Role role;

    @Builder
    public User(String email, String password, String name, String company, String department, Role role) {
        this.email = email;
        this.password = password;
        this.name = name;
        this.company = company;
        this.department = department;
        this.role = role == null ? Role.USER : role;
    }

    public void updateProfile(String name, String company, String department) {
        this.name = name;
        this.company = company;
        this.department = department;
    }

    public void changePassword(String encodedPassword) {
        this.password = encodedPassword;
    }
}
