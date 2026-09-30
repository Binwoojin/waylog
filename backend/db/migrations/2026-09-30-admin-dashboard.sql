-- admin-dashboard 기능(공지/회원/피드/여행코스 관리자 콘솔)이 요구하는 스키마 변경.
-- 이 프로젝트에는 마이그레이션 도구(Flyway 등)가 없고 jpa.hibernate.ddl-auto: none이므로,
-- 배포 전에 이 스크립트를 직접 검토한 뒤 대상 DB에 수동으로 실행해야 합니다.
--
-- 근거 문서: docs/02-design/features/admin-dashboard.design.md §3.2.1, §3.3.1, §3.4.1
-- 엔티티 근거: UserEntity.java, FeedPost.java, tourcourse/domain/*.java (컬럼명은 @Column과 동일하게 맞춤)
--
-- 적용 전 반드시 백업을 먼저 받으세요. 이미 실행한 환경에서 재실행하지 않도록
-- 각 문의 앞에 존재 여부를 확인하는 절차를 권장합니다(운영 DB는 대개 하나뿐이므로
-- 신중하게 한 번만 실행하는 것을 전제로 작성했습니다).

-- ============================================================
-- 1. 회원(users) — 활동 정지(기간제 로그인 차단, 설계 §3.2.1)
-- ============================================================
ALTER TABLE users
    ADD COLUMN SUSPENDED_UNTIL   DATETIME     NULL,
    ADD COLUMN SUSPENSION_REASON VARCHAR(255) NULL,
    ADD COLUMN SUSPENDED_AT      DATETIME     NULL;

-- ============================================================
-- 2. 피드(feed_post) — 소프트 삭제(설계 §3.4.1)
--    정책위반(하드) 삭제는 행 자체를 지우므로 이 컬럼들에 값이 남지 않는 것이
--    의도된 동작입니다(D-5).
-- ============================================================
ALTER TABLE feed_post
    ADD COLUMN deleted_at   DATETIME     NULL,
    ADD COLUMN delete_reason VARCHAR(255) NULL;

-- ============================================================
-- 3. 여행코스(tourcourse) — 신규 테이블 4개, 3단 중첩 구조(설계 §3.3.1)
--    tour_course 1 - n tour_course_day 1 - n tour_course_stop 1 - n tour_course_stop_image
-- ============================================================

CREATE TABLE tour_course (
    tour_course_id         BIGINT       NOT NULL AUTO_INCREMENT,
    title                  VARCHAR(200) NOT NULL,
    theme                  VARCHAR(100) NULL,
    cover_image_object_key VARCHAR(500) NULL,
    created_at             DATETIME     NOT NULL,
    updated_at             DATETIME     NOT NULL,
    PRIMARY KEY (tour_course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tour_course_day (
    tour_course_day_id BIGINT NOT NULL AUTO_INCREMENT,
    course_id           BIGINT NOT NULL,
    day_number          INT    NOT NULL,
    PRIMARY KEY (tour_course_day_id),
    CONSTRAINT uk_tour_course_day_number UNIQUE (course_id, day_number),
    CONSTRAINT fk_tour_course_day_course
        FOREIGN KEY (course_id) REFERENCES tour_course (tour_course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tour_course_stop (
    tour_course_stop_id BIGINT       NOT NULL AUTO_INCREMENT,
    course_day_id        BIGINT       NOT NULL,
    sort_order            INT          NOT NULL,
    stop_type              VARCHAR(20)  NOT NULL,
    tour_content_id        VARCHAR(30)  NULL,
    tour_content_type_id  INT          NULL,
    name                    VARCHAR(150) NOT NULL,
    address                 VARCHAR(255) NULL,
    latitude                DECIMAL(10,7) NULL,
    longitude               DECIMAL(10,7) NULL,
    PRIMARY KEY (tour_course_stop_id),
    CONSTRAINT fk_tour_course_stop_day
        FOREIGN KEY (course_day_id) REFERENCES tour_course_day (tour_course_day_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tour_course_stop_image (
    tour_course_stop_image_id BIGINT       NOT NULL AUTO_INCREMENT,
    stop_id                    BIGINT       NOT NULL,
    object_key                  VARCHAR(500) NOT NULL,
    sort_order                  INT          NOT NULL,
    PRIMARY KEY (tour_course_stop_image_id),
    CONSTRAINT fk_tour_course_stop_image_stop
        FOREIGN KEY (stop_id) REFERENCES tour_course_stop (tour_course_stop_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 검증(실행 후 확인용, 선택)
-- ============================================================
-- DESCRIBE users;
-- DESCRIBE feed_post;
-- SHOW CREATE TABLE tour_course;
-- SHOW CREATE TABLE tour_course_day;
-- SHOW CREATE TABLE tour_course_stop;
-- SHOW CREATE TABLE tour_course_stop_image;
