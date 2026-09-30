package kr.co.mycom.travel_korea.tourcourse.repository;

import jakarta.persistence.LockModeType;
import kr.co.mycom.travel_korea.tourcourse.domain.TourCourse;
import kr.co.mycom.travel_korea.tourcourse.domain.TourCourseStop;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseAggregateProjection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TourCourseRepository extends JpaRepository<TourCourse, Long> {

    /*
     * 관리자 코스 목록 검색 (admin-dashboard 설계 §4.1). UserRepository.search와 같은 패턴:
     * keyword가 없으면 전체, 있으면 제목/테마에 대소문자 구분 없이 부분 일치.
     *
     * 목록 응답(TourCourseListItemResponse)은 일자/경유지를 내려주지 않으므로
     * 여기서는 days를 fetch하지 않는다(N+1 걱정 없음).
     */
    @Query("""
    select c from TourCourse c
    where (:keyword is null or :keyword = ''
    or lower(c.title) like lower(concat('%', :keyword, '%'))
    or lower(c.theme) like lower(concat('%', :keyword, '%')))
    """)
    Page<TourCourse> search(@Param("keyword") String keyword, Pageable pageable);

    /*
     * 상세/수정/삭제/이미지 API 진입점. days.stops까지만 EntityGraph로 함께 조회한다.
     * stop.images는 일부러 포함하지 않는다 — FeedPostRepository가 photos+tags를 동시에
     * fetch join하지 않는 것과 같은 이유로, 컬렉션을 한 번에 여러 단계 중첩해서 fetch하면
     * 결과 행이 곱으로 늘어난다. images는 TourCourseStop의 @BatchSize로 배치 로딩한다.
     */
    @Override
    @EntityGraph(attributePaths = {"days", "days.stops"})
    Optional<TourCourse> findById(Long id);

    /*
     * 이미지 첨부(addStopImages)의 "일자당 10장 제한" count-then-write 경쟁 조건을
     * 막기 위한 조회. 같은 코스에 대한 동시 업로드 요청이 서로 순서를 기다리도록
     * PESSIMISTIC_WRITE 락을 건다(같은 트랜잭션 안에서 count와 save 사이 락을 유지).
     * 다른 화면(목록/상세/그 외 CRUD)은 계속 findById()를 그대로 쓴다 — 이미지 업로드
     * 외에는 count-then-write 경쟁 조건이 없어 락이 필요 없다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"days", "days.stops"})
    @Query("select c from TourCourse c where c.id = :id")
    Optional<TourCourse> findByIdForUpdate(@Param("id") Long id);

    /*
     * 공개 목록 전용 집계 쿼리 (tour-course-list-integration 설계 §4.2). 검색 결과
     * 페이지의 코스 id 목록에 대해 코스별 일자 수·경유지 수를 한 번에 집계한다.
     * 관리자 목록(list)은 이 쿼리를 쓰지 않는다 — 관리자 목록은 N+1 회피 결정을
     * 그대로 유지한다(TourCourseListItemResponse 주석 참고).
     */
    @Query("""
        select new kr.co.mycom.travel_korea.tourcourse.dto.TourCourseAggregateProjection(
            d.course.id, count(distinct d.id), count(s.id))
        from TourCourseDay d left join d.stops s
        where d.course.id in :courseIds
        group by d.course.id
    """)
    List<TourCourseAggregateProjection> aggregateCounts(@Param("courseIds") List<Long> courseIds);

    /*
     * 공개 목록 전용: 1일차의 경유지를 코스별로, sortOrder 오름차순으로 가져온다.
     * 서비스(TourCoursePublicService)가 이 리스트를 순회하며 코스별로 처음 만나는
     * 행(=sortOrder 최솟값)만 취해 "1일차 대표 주소"로 사용한다(설계 §4.2).
     */
    @Query("""
        select s from TourCourseStop s
        where s.day.dayNumber = 1 and s.day.course.id in :courseIds
        order by s.day.course.id asc, s.sortOrder asc
    """)
    List<TourCourseStop> findFirstDayStopsOrderedByCourse(@Param("courseIds") List<Long> courseIds);
}
