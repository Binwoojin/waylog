-- ============================================================
-- users 이메일·닉네임 유니크 제약 (동시 가입 정합성)
--
-- 상태: 작성만 함. 운영 DB에는 아직 적용하지 않았다.
--
-- 적용 전 필수 확인 (backend/db/checks/readonly-precheck.sql)
--   1. 8장: EMAIL, NICKNAME 중복 행이 0행인지 확인한다.
--      행이 있으면 중복 계정을 먼저 정리하고 다시 확인한다. 이 파일은 실행하지 않는다.
--   2. 8-1: users 에 이미 같은 컬럼의 유니크 인덱스가 있는지 확인한다.
--      이미 있으면 해당 ALTER 문장은 건너뛴다(이중 생성 방지).
--   3. 9장: users 의 콜레이션을 확인하고 docs/development/users-unique-keys.md 의 비교 정책과 맞는지 본다.
--   4. 운영 DB 백업을 먼저 받는다.
--
-- 제약 이름은 엔티티(UserEntity @Table uniqueConstraints)와 같아야 한다.
-- 테스트(NicknameUniquenessHttpFlowTest)가 같은 이름으로 H2에 제약을 만들어 검증한다.
--
-- 실행 순서: 이 파일 하나만 실행한다(다른 마이그레이션과 순서 의존 없음).
-- 롤백: ALTER TABLE users DROP INDEX uk_users_email; ALTER TABLE users DROP INDEX uk_users_nickname;
-- ============================================================

ALTER TABLE users
    ADD CONSTRAINT uk_users_email UNIQUE (EMAIL);

ALTER TABLE users
    ADD CONSTRAINT uk_users_nickname UNIQUE (NICKNAME);

-- 적용 후 확인 (읽기 전용)
-- SELECT index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS cols
-- FROM information_schema.STATISTICS
-- WHERE table_schema = DATABASE() AND table_name = 'users' AND non_unique = 0
-- GROUP BY index_name;
