package kr.co.mycom.travel_korea.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * db/migrations/*.sql 3개가 "기존 DB 업그레이드" 시나리오에서 올바르게 적용되는지 검증한다.
 *
 * 절차 (운영 DB는 사용하지 않는다. H2 MySQL 모드의 독립 메모리 DB만 사용):
 *  1. 엔티티 기준 DDL을 Hibernate(test 프로필 create-drop)로 만든 뒤 SCRIPT NODATA로 추출한다.
 *     (테스트 전용 src/test/resources/schema.sql이 추가한 linked_course FK는 제외한다.)
 *  2. 마이그레이션이 추가하는 컬럼·테이블·FK·인덱스를 제거해 "마이그레이션 이전의 기존 DB"를 재현한다.
 *     전제 테이블(users, feed_post, feed_like, feed_bookmark, tour_bookmark 등)은 그대로 둔다.
 *  3. 2026-09-30 -> 2026-10-01 -> 2026-10-02 순서로 마이그레이션 SQL을 실행한다.
 *  4. 적용 결과의 컬럼 집합이 엔티티 DDL과 같은지, FK의 ON DELETE SET NULL이 실제로 동작하는지 확인한다.
 */
@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class MigrationUpgradeVerificationTest {

    private static final List<String> MIGRATIONS = List.of(
            "2026-09-30-admin-dashboard.sql",
            "2026-10-01-tour-course-feed-linking.sql",
            "2026-10-02-mypage-bookmarks.sql"
    );

    @Autowired
    private JdbcTemplate testDbTemplate;

    @Test
    void upgradeFromPreMigrationSchemaMatchesEntitySchema() throws IOException {
        String url = "jdbc:h2:mem:mig-upgrade-" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1";
        JdbcTemplate db = new JdbcTemplate(new DriverManagerDataSource(url, "sa", ""));

        // 1. 엔티티 기준 스키마 추출 후 적용
        for (String statement : entityDdl()) {
            db.execute(statement);
        }
        Set<String> entityColumns = columns(db);

        // 2. 마이그레이션 이전 상태로 되돌림 (기존 DB 재현)
        for (String statement : preMigrationRollback()) {
            db.execute(statement);
        }
        assertFalse(columns(db).contains("FEED_POST.LINKED_COURSE_ID"), "롤백 전제가 깨졌습니다");

        // 3. 마이그레이션 순서대로 적용 (하나라도 실패하면 즉시 실패)
        for (String file : MIGRATIONS) {
            for (String statement : migrationStatements(file)) {
                try {
                    db.execute(statement);
                } catch (RuntimeException exception) {
                    fail(file + " 적용 실패: " + firstLine(statement) + " -> " + exception.getMessage());
                }
            }
        }

        // 4-a. 컬럼 집합이 엔티티 DDL과 일치해야 한다 (누락·추가 없음)
        Set<String> upgradedColumns = columns(db);
        assertEquals(entityColumns, upgradedColumns, "마이그레이션 결과 컬럼이 엔티티와 다릅니다");

        // 4-b. 연동 FK 3개가 ON DELETE SET NULL로 존재해야 한다
        Map<String, Object> rules = db.queryForMap(
                "SELECT COUNT(*) AS CNT FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS "
                        + "WHERE CONSTRAINT_NAME LIKE 'FK_FEED_POST_LINKED_COURSE%' AND DELETE_RULE = 'SET NULL'");
        assertEquals(3L, ((Number) rules.get("CNT")).longValue());

        // 4-c. 피드 코스 필터용 인덱스
        Integer indexCount = db.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.INDEXES WHERE INDEX_NAME = 'IDX_FEED_POST_LINKED_COURSE_ID'",
                Integer.class);
        assertEquals(1, indexCount);

        // 4-d. 실제 삭제 동작: 경유지 -> 일자 -> 코스 순으로 지워도 피드 참조만 끊기고 삭제는 성공해야 한다
        seedCourseAndFeed(db);
        db.update("DELETE FROM tour_course_stop WHERE tour_course_stop_id = 9001");
        assertNull(linkedValue(db, "linked_course_stop_id"));
        assertEquals(9001L, ((Number) linkedValue(db, "linked_course_id")).longValue());

        db.update("DELETE FROM tour_course_day WHERE tour_course_day_id = 9001");
        assertNull(linkedValue(db, "linked_course_day_id"));
        assertNotNull(linkedValue(db, "linked_course_id"));

        db.update("DELETE FROM tour_course WHERE tour_course_id = 9001");
        assertNull(linkedValue(db, "linked_course_id"));
        assertEquals("마이그레이션 검증 코스", linkedValue(db, "linked_course_title"), "스냅샷 제목은 남아야 합니다");

        // 4-e. 존재하지 않는 코스를 참조하는 피드는 FK가 막아야 한다
        assertThrows(DataIntegrityViolationException.class, () ->
                db.update("UPDATE feed_post SET linked_course_id = 424242 WHERE feed_post_id = 9001"));
    }

    private List<String> entityDdl() {
        List<String> statements = new ArrayList<>();
        for (Map<String, Object> row : testDbTemplate.queryForList("SCRIPT NODATA")) {
            String statement = String.valueOf(row.get("SCRIPT")).trim();
            String upper = statement.toUpperCase();
            if (upper.startsWith("CREATE USER") || upper.startsWith("CREATE SCHEMA")
                    || upper.startsWith("ALTER SCHEMA") || upper.startsWith("ALTER USER")
                    || upper.startsWith("SET ") || upper.startsWith("CREATE ROLE")
                    || upper.startsWith("GRANT")) {
                continue;
            }
            // schema.sql이 테스트 전용으로 추가한 FK는 마이그레이션이 만들어야 할 대상이므로 제외한다
            if (upper.contains("FK_FEED_POST_LINKED_COURSE")) {
                continue;
            }
            statements.add(statement);
        }
        return statements;
    }

    private List<String> preMigrationRollback() {
        return List.of(
                "ALTER TABLE feed_post DROP COLUMN linked_course_stop_name",
                "ALTER TABLE feed_post DROP COLUMN linked_course_stop_id",
                "ALTER TABLE feed_post DROP COLUMN linked_course_day_number",
                "ALTER TABLE feed_post DROP COLUMN linked_course_day_id",
                "ALTER TABLE feed_post DROP COLUMN linked_course_title",
                "ALTER TABLE feed_post DROP COLUMN linked_course_id",
                "ALTER TABLE feed_post DROP COLUMN delete_reason",
                "ALTER TABLE feed_post DROP COLUMN deleted_at",
                "ALTER TABLE users DROP COLUMN WITHDRAWN_AT",
                "ALTER TABLE users DROP COLUMN SUSPENDED_AT",
                "ALTER TABLE users DROP COLUMN SUSPENSION_REASON",
                "ALTER TABLE users DROP COLUMN SUSPENDED_UNTIL",
                "DROP TABLE tour_course_stop_image",
                "DROP TABLE tour_course_stop",
                "DROP TABLE tour_course_day",
                "DROP TABLE tour_course"
        );
    }

    private List<String> migrationStatements(String file) throws IOException {
        Path path = Path.of("db", "migrations", file);
        String sql = Files.readAllLines(path).stream()
                .filter(line -> !line.trim().startsWith("--"))
                .collect(Collectors.joining("\n"));
        List<String> statements = new ArrayList<>();
        for (String part : sql.split(";")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                statements.addAll(toH2Compatible(trimmed));
            }
        }
        return statements;
    }

    /*
     * MySQL은 "ALTER TABLE t ADD COLUMN a ..., ADD COLUMN b ..." 한 문장에 여러 ADD를 허용하지만
     * H2는 이 문법을 받지 않는다(구문 오류 확인). 마이그레이션 파일은 수정하지 않고, 이 테스트 harness에서만
     * 같은 의미의 ADD 문장으로 나눠 실행한다. 쉼표는 ADD 절 구분자로만 쓰이므로(컬럼 정의에 쉼표 없음) 안전하다.
     */
    private List<String> toH2Compatible(String statement) {
        String upper = statement.toUpperCase();
        if (!upper.startsWith("ALTER TABLE") || upper.split("ADD COLUMN", -1).length - 1 < 2) {
            return List.of(statement);
        }
        String[] head = statement.split("\\s+", 4);
        String table = head[2];
        String body = statement.substring(statement.toUpperCase().indexOf("ADD COLUMN"));
        List<String> split = new ArrayList<>();
        for (String clause : body.split(",")) {
            split.add("ALTER TABLE " + table + " " + clause.trim());
        }
        return split;
    }

    private Set<String> columns(JdbcTemplate db) {
        return db.queryForList(
                        "SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                                + "WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_NAME IN "
                                + "('USERS','FEED_POST','TOUR_COURSE','TOUR_COURSE_DAY','TOUR_COURSE_STOP','TOUR_COURSE_STOP_IMAGE')")
                .stream()
                .map(row -> row.get("TABLE_NAME") + "." + row.get("COLUMN_NAME"))
                .collect(Collectors.toCollection(TreeSet::new));
    }

    private void seedCourseAndFeed(JdbcTemplate db) {
        db.update("INSERT INTO users (USER_ID, EMAIL, NICKNAME, PASSWORD_HASH, CREATED_AT) "
                + "VALUES (9001, 'mig-verify@test.com', 'mig검증', 'hash', CURRENT_TIMESTAMP)");
        db.update("INSERT INTO tour_course (tour_course_id, title, created_at, updated_at) "
                + "VALUES (9001, '마이그레이션 검증 코스', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
        db.update("INSERT INTO tour_course_day (tour_course_day_id, course_id, day_number) VALUES (9001, 9001, 1)");
        db.update("INSERT INTO tour_course_stop (tour_course_stop_id, course_day_id, sort_order, stop_type, name) "
                + "VALUES (9001, 9001, 1, 'CUSTOM', '경유지')");
        db.update("INSERT INTO feed_post (feed_post_id, user_id, content, visibility, like_count, comment_count, "
                + "created_at, updated_at, linked_course_id, linked_course_title, linked_course_day_id, "
                + "linked_course_day_number, linked_course_stop_id, linked_course_stop_name) "
                + "VALUES (9001, 9001, '본문', 'PUBLIC', 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, "
                + "9001, '마이그레이션 검증 코스', 9001, 1, 9001, '경유지')");
    }

    private Object linkedValue(JdbcTemplate db, String column) {
        return db.queryForObject("SELECT " + column + " FROM feed_post WHERE feed_post_id = 9001", Object.class);
    }

    private String firstLine(String statement) {
        return statement.lines().findFirst().orElse(statement);
    }
}
