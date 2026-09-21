package com.xisnd.monitoring.common;

import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManagerFactory;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

// ddl-auto update 는 컬럼 타입을 안 바꿔서 예전 enum 컬럼을 직접 varchar 로 바꾼다
@Slf4j
@Component
public class EnumColumnMigration {

    private static final String H2_QUERY = """
            select table_name, column_name, is_nullable from information_schema.columns
            where table_schema = 'PUBLIC' and data_type = 'ENUM'
            """;
    private static final String MYSQL_QUERY = """
            select table_name, column_name, is_nullable from information_schema.columns
            where table_schema = database() and data_type = 'enum'
            """;

    private final DataSource dataSource;

    public EnumColumnMigration(DataSource dataSource, EntityManagerFactory schemaReady) {
        this.dataSource = dataSource;
    }

    @PostConstruct
    void migrate() {
        try (Connection c = dataSource.getConnection(); Statement st = c.createStatement()) {
            String product = c.getMetaData().getDatabaseProductName();
            boolean h2 = "H2".equalsIgnoreCase(product);
            if (!h2 && !"MySQL".equalsIgnoreCase(product)) {
                return;
            }

            List<String> statements = new ArrayList<>();
            try (ResultSet rs = st.executeQuery(h2 ? H2_QUERY : MYSQL_QUERY)) {
                while (rs.next()) {
                    String table = rs.getString(1);
                    String column = rs.getString(2);
                    boolean nullable = "YES".equalsIgnoreCase(rs.getString(3));
                    statements.add(h2
                            ? "ALTER TABLE \"" + table + "\" ALTER COLUMN \"" + column + "\" SET DATA TYPE VARCHAR(50)"
                            : "ALTER TABLE `" + table + "` MODIFY `" + column + "` VARCHAR(50)" + (nullable ? " NULL" : " NOT NULL"));
                }
            }
            for (String sql : statements) {
                st.execute(sql);
            }
            if (!statements.isEmpty()) {
                log.info("enum 컬럼 {}개를 varchar 로 바꿨습니다.", statements.size());
            }
        } catch (Exception e) {
            log.warn("enum 컬럼 변환 실패: {}", e.getMessage());
        }
    }
}
