-- tour-course-feed-linking 설계 §5, §11.1(T-6, T-7) — 테스트 전용 FK 보강 스크립트.
--
-- 설계 §3.1은 FeedPost.linkedCourseId 등을 @ManyToOne이 아니라 단순 @Column으로
-- 매핑한다(모듈 결합 최소화). 그 결과 Hibernate ddl-auto(create-drop)는 이 컬럼들에
-- 대한 FK 제약을 자동으로 만들어 주지 않는다 — 운영 DB의 FK + ON DELETE SET NULL은
-- 전적으로 backend/db/migrations/2026-10-01-tour-course-feed-linking.sql(수동 SQL)이
-- 책임진다.
--
-- "ON DELETE SET NULL이 실제로 동작하는지는 코드 리뷰만으로 확신할 수 없고 반드시
-- 통합 테스트(실제 DB 또는 H2 등 FK를 지원하는 테스트 DB)로 확인해야 한다"(설계 §11.1)는
-- 요구를 충족하기 위해, 테스트 전용 H2 스키마에도 운영과 동일한 FK 제약을 추가한다.
--
-- spring.jpa.defer-datasource-initialization=true(application-test.yaml) 덕분에 이
-- 스크립트는 Hibernate가 create-drop으로 모든 테이블을 만든 "다음"에 실행된다.
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
