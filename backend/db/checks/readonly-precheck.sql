-- ============================================================
-- 배포 전 읽기 전용 점검 (운영 DB에서 실행)
--
-- 목적: 마이그레이션 적용 여부와 전제 스키마를 확인한다.
-- 원칙: 전부 SELECT 문이다. 데이터·스키마를 바꾸지 않는다.
-- 사용: 아래 쿼리를 순서대로 실행하고 결과를 그대로 공유한다.
--       결과를 받기 전까지 저장소 문서의 해당 항목은 "미확인"으로 둔다.
-- ============================================================

-- ------------------------------------------------------------
-- 0. 대상 DB 확인 (엉뚱한 스키마를 보고 있지 않은지)
-- ------------------------------------------------------------
SELECT DATABASE() AS current_schema, VERSION() AS mysql_version;

-- ------------------------------------------------------------
-- 1. 전제 테이블 존재 여부 (마이그레이션 이전 기존 객체)
--    결과에 빠진 이름이 있으면 마이그레이션 전에 원인을 먼저 확인한다.
-- ------------------------------------------------------------
SELECT t.table_name AS required_table,
       CASE WHEN i.table_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (
    SELECT 'users' AS table_name UNION ALL
    SELECT 'feed_post' UNION ALL
    SELECT 'feed_like' UNION ALL
    SELECT 'feed_comment' UNION ALL
    SELECT 'feed_bookmark' UNION ALL
    SELECT 'feed_photo' UNION ALL
    SELECT 'feed_tag' UNION ALL
    SELECT 'feed_profile' UNION ALL
    SELECT 'tour_bookmark'
) t
LEFT JOIN information_schema.TABLES i
  ON i.table_schema = DATABASE() AND i.table_name = t.table_name;

-- ------------------------------------------------------------
-- 2. 전제 컬럼 존재 여부 (마이그레이션 이전 기존 객체)
--    feed_post.visibility 는 엔티티에서 NOT NULL 이다.
-- ------------------------------------------------------------
SELECT c.table_name, c.column_name, c.is_nullable, c.column_type
FROM information_schema.COLUMNS c
WHERE c.table_schema = DATABASE()
  AND ((c.table_name = 'users' AND c.column_name IN ('EMAIL', 'NICKNAME', 'PASSWORD_HASH', 'INTRODUCE', 'PROFILE_IMAGE', 'GENDER', 'GRADE', 'CREATED_AT'))
    OR (c.table_name = 'feed_post' AND c.column_name IN ('feed_post_id', 'user_id', 'content', 'visibility', 'like_count', 'comment_count', 'created_at', 'updated_at', 'tour_content_id', 'tour_content_type_id'))
    OR (c.table_name = 'tour_bookmark' AND c.column_name IN ('user_id', 'content_id', 'content_type_id')))
ORDER BY c.table_name, c.column_name;

-- ------------------------------------------------------------
-- 3. 마이그레이션 적용 흔적 (이미 적용됐는지)
--    각 행이 있으면 해당 마이그레이션(또는 일부)이 적용된 것이다.
-- ------------------------------------------------------------
SELECT c.table_name, c.column_name, c.is_nullable, c.column_type
FROM information_schema.COLUMNS c
WHERE c.table_schema = DATABASE()
  AND ((c.table_name = 'users' AND c.column_name IN ('SUSPENDED_UNTIL', 'SUSPENSION_REASON', 'SUSPENDED_AT', 'WITHDRAWN_AT'))
    OR (c.table_name = 'feed_post' AND c.column_name IN ('deleted_at', 'delete_reason', 'linked_course_id', 'linked_course_title', 'linked_course_day_id', 'linked_course_day_number', 'linked_course_stop_id', 'linked_course_stop_name')))
ORDER BY c.table_name, c.column_name;

-- 3-1. 신규 테이블 4개 존재 여부 (09-30 마이그레이션)
SELECT table_name, table_rows
FROM information_schema.TABLES
WHERE table_schema = DATABASE()
  AND table_name IN ('tour_course', 'tour_course_day', 'tour_course_stop', 'tour_course_stop_image');

-- ------------------------------------------------------------
-- 4. 인덱스 (이름 기준)
--    uk_tour_bookmark_user_content: 북마크 중복 방지(엔티티 @UniqueConstraint)
--    uk_tour_course_day_number: 코스 일자 번호 유니크
--    idx_feed_post_linked_course_id: 10-01 마이그레이션 추가 인덱스
-- ------------------------------------------------------------
SELECT table_name, index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_in_order, non_unique
FROM information_schema.STATISTICS
WHERE table_schema = DATABASE()
  AND (index_name IN ('uk_tour_bookmark_user_content', 'uk_tour_course_day_number', 'idx_feed_post_linked_course_id', 'idx_feed_post_created_at', 'idx_feed_post_user_id')
    OR (table_name = 'tour_bookmark' AND non_unique = 0))
GROUP BY table_name, index_name, non_unique
ORDER BY table_name, index_name;

-- ------------------------------------------------------------
-- 5. 외래키와 삭제 규칙 (연동 FK 3개는 ON DELETE SET NULL 이어야 한다)
-- ------------------------------------------------------------
SELECT rc.constraint_name, kcu.table_name, kcu.column_name,
       kcu.referenced_table_name, kcu.referenced_column_name,
       rc.delete_rule, rc.update_rule
FROM information_schema.REFERENTIAL_CONSTRAINTS rc
JOIN information_schema.KEY_COLUMN_USAGE kcu
  ON kcu.constraint_schema = rc.constraint_schema
 AND kcu.constraint_name = rc.constraint_name
 AND kcu.table_name = rc.table_name
WHERE rc.constraint_schema = DATABASE()
  AND (rc.constraint_name IN ('fk_feed_post_linked_course', 'fk_feed_post_linked_course_day', 'fk_feed_post_linked_course_stop',
                              'fk_tour_course_day_course', 'fk_tour_course_stop_day', 'fk_tour_course_stop_image_stop')
    OR kcu.table_name IN ('feed_post', 'tour_bookmark'))
ORDER BY kcu.table_name, rc.constraint_name;

-- ------------------------------------------------------------
-- 6. 데이터 점검 (읽기 전용 집계)
--    탈퇴·정지 계정 수, 연동 피드 수가 0 인지(적용 직후 기대값) 확인한다.
-- ------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM users WHERE WITHDRAWN_AT IS NOT NULL) AS withdrawn_users,
  (SELECT COUNT(*) FROM users WHERE SUSPENDED_UNTIL IS NOT NULL) AS suspended_users,
  (SELECT COUNT(*) FROM feed_post WHERE linked_course_id IS NOT NULL) AS linked_feed_posts;

-- ------------------------------------------------------------
-- 7. 마이그레이션 이력 테이블이 없으므로 수동 기록 여부 확인용
--    (도구 이력이 없는 프로젝트이므로 이 결과는 참고용이다)
-- ------------------------------------------------------------
SELECT table_name
FROM information_schema.TABLES
WHERE table_schema = DATABASE()
  AND table_name IN ('flyway_schema_history', 'schema_migrations', 'databasechangelog');

-- ------------------------------------------------------------
-- 8. 가입 식별자 중복 점검 (EMAIL, NICKNAME)
--    서버 중복 검사(3ae69f1) 이후에도 기존 데이터에 중복이 남아 있을 수 있다.
--    DB 유니크 제약(users.EMAIL, users.NICKNAME)을 추가하기 전에 이 결과가 0행이어야 한다.
--    행이 나오면 유니크 제약 적용을 멈추고 중복 행을 먼저 정리한다(운영 DB를 직접 고치지 않는다).
-- ------------------------------------------------------------
SELECT 'EMAIL' AS duplicated_column, EMAIL AS duplicated_value, COUNT(*) AS row_count
FROM users
GROUP BY EMAIL
HAVING COUNT(*) > 1;

SELECT 'NICKNAME' AS duplicated_column, NICKNAME AS duplicated_value, COUNT(*) AS row_count
FROM users
GROUP BY NICKNAME
HAVING COUNT(*) > 1;

-- 8-1. users 의 현재 유니크 인덱스 (이미 유니크 제약이 있는지 확인)
--      엔티티에는 unique 설정이 없으므로(UserEntity) 보통 아무 행도 나오지 않는다.
SELECT index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_in_order
FROM information_schema.STATISTICS
WHERE table_schema = DATABASE()
  AND table_name = 'users'
  AND non_unique = 0
GROUP BY index_name;


-- ------------------------------------------------------------
-- 9. 가입 식별자 비교 정책 확인 (콜레이션)
--    서버 중복 검사(existsByEmail, existsByNickname)와 유니크 제약은 컬럼 콜레이션에 따라 비교한다.
--    대소문자·악센트 무시 여부, 끝 공백 처리(NO PAD)가 여기서 결정된다.
--    결과를 docs/development/users-unique-keys.md 의 비교 정책과 대조한다.
-- ------------------------------------------------------------
SELECT table_name, table_collation
FROM information_schema.TABLES
WHERE table_schema = DATABASE()
  AND table_name = 'users';

SELECT column_name, collation_name, character_maximum_length
FROM information_schema.COLUMNS
WHERE table_schema = DATABASE()
  AND table_name = 'users'
  AND column_name IN ('EMAIL', 'NICKNAME');
