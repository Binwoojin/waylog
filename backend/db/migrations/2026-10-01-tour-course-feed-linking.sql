-- tour-course-feed-linking 기능이 요구하는 스키마 변경.
-- 이 프로젝트에는 마이그레이션 도구(Flyway 등)가 없고 jpa.hibernate.ddl-auto: none이므로,
-- 배포 전에 이 스크립트를 직접 검토한 뒤 대상 DB에 수동으로 실행해야 합니다.
--
-- 근거 문서: docs/02-design/features/tour-course-feed-linking.design.md §3, §5
-- 엔티티 근거: FeedPost.java(신규 컬럼), tour_course/tour_course_day/tour_course_stop
--             (기존 테이블, 2026-09-30-admin-dashboard.sql에서 생성됨 — 이 스크립트는 그 테이블들을
--             변경하지 않고 참조만 한다)
--
-- 적용 전 반드시 백업을 먼저 받으세요. 이미 실행한 환경에서 재실행하지 않도록 주의하세요.

-- ============================================================
-- 피드(feed_post) — 여행코스 일자/경유지 참조 컬럼 추가(설계 §3)
--
-- ON DELETE SET NULL을 쓰는 이유(설계 §5): tour_course_day/tour_course_stop를 가리키는
-- 기존 FK(fk_tour_course_day_course 등, 2026-09-30 마이그레이션)는 ON DELETE 절이 없어
-- 기본값 RESTRICT다. 이 세 FK에도 같은 기본값을 쓰면, 참조 중인 일자·경유지·코스를
-- 관리자가 지우려 할 때 DB가 삭제 자체를 거부해 TourCourseAdminService.update()/delete()가
-- 원인 불명의 오류로 실패한다. SET NULL로 지정해 "참조 대상이 사라지면 피드 쪽 참조만
-- 조용히 끊어지고, 코스 관리 작업 자체는 항상 성공"하게 만든다.
-- ============================================================
ALTER TABLE feed_post
    ADD COLUMN linked_course_id          BIGINT       NULL,
    ADD COLUMN linked_course_title       VARCHAR(200) NULL,
    ADD COLUMN linked_course_day_id      BIGINT       NULL,
    ADD COLUMN linked_course_day_number  INT          NULL,
    ADD COLUMN linked_course_stop_id     BIGINT       NULL,
    ADD COLUMN linked_course_stop_name   VARCHAR(150) NULL;

-- 운영 MySQL 버전에 따라 ALTER TABLE 한 문장에 여러 ADD CONSTRAINT를 받아들이지 않을 수
-- 있어(설계 §10 O-1), 안전하게 FK마다 별도 ALTER TABLE 문장으로 나눈다.
ALTER TABLE feed_post
    ADD CONSTRAINT fk_feed_post_linked_course
        FOREIGN KEY (linked_course_id) REFERENCES tour_course (tour_course_id)
        ON DELETE SET NULL;

ALTER TABLE feed_post
    ADD CONSTRAINT fk_feed_post_linked_course_day
        FOREIGN KEY (linked_course_day_id) REFERENCES tour_course_day (tour_course_day_id)
        ON DELETE SET NULL;

ALTER TABLE feed_post
    ADD CONSTRAINT fk_feed_post_linked_course_stop
        FOREIGN KEY (linked_course_stop_id) REFERENCES tour_course_stop (tour_course_stop_id)
        ON DELETE SET NULL;

-- 코스 상세의 "참조 피드 목록" 조회(GET /api/v1/feed/posts?linkedCourseId=)가
-- linked_course_id 단일 조건 + id 정렬로 스캔하므로 인덱스를 추가한다
-- (기존 idx_feed_post_user_id와 같은 목적의 조회 성능 인덱스).
CREATE INDEX idx_feed_post_linked_course_id ON feed_post (linked_course_id);

-- 기존 피드 게시물(연동 필드 없음)은 이 ALTER로 전부 NULL이 자동 할당된다.
-- 별도 UPDATE/백필 구문이 필요 없다(계획 Q-4 확정, 설계 D-7).

-- ============================================================
-- 검증(실행 후 확인용, 선택)
-- ============================================================
-- DESCRIBE feed_post;
-- SHOW CREATE TABLE feed_post;
-- SELECT COUNT(*) FROM feed_post WHERE linked_course_id IS NOT NULL; -- 적용 직후 0이어야 정상
