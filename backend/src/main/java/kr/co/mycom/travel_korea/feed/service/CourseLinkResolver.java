package kr.co.mycom.travel_korea.feed.service;

import kr.co.mycom.travel_korea.tourcourse.domain.TourCourse;
import kr.co.mycom.travel_korea.tourcourse.domain.TourCourseDay;
import kr.co.mycom.travel_korea.tourcourse.domain.TourCourseStop;
import kr.co.mycom.travel_korea.tourcourse.repository.TourCourseDayRepository;
import kr.co.mycom.travel_korea.tourcourse.repository.TourCourseStopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * tour-course-feed-linking 설계 §3.2 — 클라이언트가 보낸 dayId/stopId를 받아
 * 코스(day → course) 체인을 검증하고 스냅샷(코스명/일자 번호/경유지명)을 만든다.
 *
 * "체인은 서버가 책임진다"는 설계 원칙(§1.2)에 따라, 클라이언트는 courseId를 보내지
 * 않는다 — courseId와 스냅샷은 이 리졸버가 day→course 체인을 직접 따라가 채우므로
 * 클라이언트가 서로 다른 코스의 day/stop id를 섞어 보내는 모순된 요청 자체가 생길
 * 수 없다.
 */
@Component
@RequiredArgsConstructor
class CourseLinkResolver {

    private final TourCourseDayRepository tourCourseDayRepository;
    private final TourCourseStopRepository tourCourseStopRepository;

    /**
     * dayId/stopId를 받아 코스 체인을 검증하고 스냅샷을 만든다.
     * 둘 다 null이면 "미태그" 스냅샷(전부 null)을 반환한다.
     *
     * day.getCourse()가 LAZY 연관관계라서, 이 메서드 자체를 읽기 전용 트랜잭션으로
     * 열어 FeedService.create()의 기존 트랜잭션에 참여(REQUIRED)하거나, 단독으로
     * 호출되더라도(예: 단위 테스트) 세션이 끊기지 않고 지연 로딩이 성공하게 한다.
     */
    @Transactional(readOnly = true)
    CourseLinkSnapshot resolve(Long dayId, Long stopId) {
        if (dayId == null && stopId == null) {
            return CourseLinkSnapshot.empty();
        }

        if (dayId == null) {
            // 일자 없이 경유지만 지정 — 허용하지 않는 상태(설계 §3.2).
            throw new IllegalArgumentException("여행코스를 태그하려면 일자를 함께 선택해야 합니다.");
        }

        TourCourseDay day = tourCourseDayRepository.findById(dayId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 여행코스 일자입니다."));
        TourCourse course = day.getCourse();

        if (stopId == null) {
            return new CourseLinkSnapshot(course.getId(), course.getTitle(), day.getId(), day.getDayNumber(), null, null);
        }

        TourCourseStop stop = tourCourseStopRepository.findById(stopId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 여행코스 경유지입니다."));

        if (!stop.getDay().getId().equals(day.getId())) {
            throw new IllegalArgumentException("선택한 경유지가 해당 일자 소속이 아닙니다.");
        }

        return new CourseLinkSnapshot(course.getId(), course.getTitle(), day.getId(), day.getDayNumber(), stop.getId(), stop.getName());
    }

    record CourseLinkSnapshot(Long courseId, String courseTitle, Long dayId, Integer dayNumber, Long stopId, String stopName) {
        static CourseLinkSnapshot empty() {
            return new CourseLinkSnapshot(null, null, null, null, null, null);
        }
    }
}
