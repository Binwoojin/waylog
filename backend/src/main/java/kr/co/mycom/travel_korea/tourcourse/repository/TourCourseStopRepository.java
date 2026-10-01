package kr.co.mycom.travel_korea.tourcourse.repository;

import kr.co.mycom.travel_korea.tourcourse.domain.TourCourseStop;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * tour-course-feed-linking 설계 §3.2 — feed 모듈(CourseLinkResolver)이 "이 경유지가
 * 실제로 존재하고 어느 일자 소속인지"만 검증하기 위한 읽기 전용 최소 리포지토리다.
 *
 * tourcourse 모듈 자신은 여전히 TourCourseRepository(집합체 단위 접근)만 사용하고
 * 이 리포지토리는 호출하지 않는다 — feed 모듈의 단방향 검증 전용(설계 §2.1).
 */
public interface TourCourseStopRepository extends JpaRepository<TourCourseStop, Long> {
}
