package com.xisnd.monitoring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.xisnd.monitoring.common.EnumColumnMigration;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class EnumColumnMigrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private EnumColumnMigration migration;

    @Test
    void 예전_enum_컬럼을_varchar_로_바꿔_새_값을_받는다() throws Exception {
        jdbc.execute("create table legacy_event (id bigint primary key, type enum('A','B') not null)");
        assertThatThrownBy(() -> jdbc.update("insert into legacy_event values (1, 'NEW_TYPE')"));

        Method migrate = EnumColumnMigration.class.getDeclaredMethod("migrate");
        migrate.setAccessible(true);
        migrate.invoke(migration);

        jdbc.update("insert into legacy_event values (1, 'NEW_TYPE')");
        assertThat(jdbc.queryForObject("select type from legacy_event where id = 1", String.class)).isEqualTo("NEW_TYPE");
        jdbc.execute("drop table legacy_event");
    }
}
