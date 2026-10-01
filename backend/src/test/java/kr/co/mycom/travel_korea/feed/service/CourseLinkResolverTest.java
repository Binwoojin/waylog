package kr.co.mycom.travel_korea.feed.service;

import kr.co.mycom.travel_korea.tourcourse.domain.StopType;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseDayRequest;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseResponse;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseSaveRequest;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseStopRequest;
import kr.co.mycom.travel_korea.tourcourse.service.TourCourseAdminService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * tour-course-feed-linking 설계 §3.2, §11.1(T-1~T-5) — CourseLinkResolver 단위 검증.
 *
 * CourseLinkResolver는 feed.service 패키지 소속의 package-private 클래스라서, 같은
 * 패키지의 테스트 소스(src/test/java의 동일 패키지)에서만 직접 주입받아 호출할 수 있다.
 * 코스/일자/경유지 테스트 데이터는 TourCourseAdminServiceTest와 같은 패턴으로
 * TourCourseAdminService.create()를 통해 만든다(§15.2 권장 순서 — 검증 로직을 먼저
 * 안정화한 뒤 FeedService.create에 연결).
 */
@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class CourseLinkResolverTest {

    @Autowired
    private CourseLinkResolver courseLinkResolver;
    @Autowired
    private TourCourseAdminService tourCourseAdminService;

    private TourCourseStopRequest customStop(int sortOrder, String name) {
        return new TourCourseStopRequest(null, sortOrder, StopType.CUSTOM, null, null, name, "제주 구좌읍", null, null);
    }

    private TourCourseResponse createTwoDayCourse() {
        TourCourseDayRequest day1 = new TourCourseDayRequest(null, 1, List.of(
                customStop(1, "성산일출봉"),
                customStop(2, "동네 해녀식당")
        ));
        TourCourseDayRequest day2 = new TourCourseDayRequest(null, 2, List.of(
                customStop(1, "협재 해수욕장")
        ));

        return tourCourseAdminService.create(new TourCourseSaveRequest("코스링크 테스트 코스", "가족여행", List.of(day1, day2)));
    }

    // 둘 다 null이면 "미태그" 스냅샷(전부 null)을 반환한다.
    @Test
    void resolveWithBothNullReturnsEmptySnapshot() {
        CourseLinkResolver.CourseLinkSnapshot snapshot = courseLinkResolver.resolve(null, null);

        assertNull(snapshot.courseId());
        assertNull(snapshot.courseTitle());
        assertNull(snapshot.dayId());
        assertNull(snapshot.dayNumber());
        assertNull(snapshot.stopId());
        assertNull(snapshot.stopName());
    }

    // T-1: dayId만 지정하면 courseId/courseTitle/dayNumber가 채워지고 stopId/stopName은 null이다.
    @Test
    void resolveWithDayOnlyFillsCourseAndDayFields() {
        TourCourseResponse course = createTwoDayCourse();
        Long dayId = course.days().get(0).id();

        CourseLinkResolver.CourseLinkSnapshot snapshot = courseLinkResolver.resolve(dayId, null);

        assertEquals(course.id(), snapshot.courseId());
        assertEquals(course.title(), snapshot.courseTitle());
        assertEquals(dayId, snapshot.dayId());
        assertEquals(1, snapshot.dayNumber());
        assertNull(snapshot.stopId());
        assertNull(snapshot.stopName());
    }

    // T-2: dayId + stopId(정상 소속)면 모든 참조 필드가 채워진다.
    @Test
    void resolveWithDayAndStopFillsAllFields() {
        TourCourseResponse course = createTwoDayCourse();
        Long dayId = course.days().get(0).id();
        Long stopId = course.days().get(0).stops().get(0).id();

        CourseLinkResolver.CourseLinkSnapshot snapshot = courseLinkResolver.resolve(dayId, stopId);

        assertEquals(course.id(), snapshot.courseId());
        assertEquals(dayId, snapshot.dayId());
        assertEquals(1, snapshot.dayNumber());
        assertEquals(stopId, snapshot.stopId());
        assertEquals("성산일출봉", snapshot.stopName());
    }

    // T-3: 일자 없이 경유지만 지정하면 400(IllegalArgumentException).
    @Test
    void resolveWithStopOnlyThrows() {
        TourCourseResponse course = createTwoDayCourse();
        Long stopId = course.days().get(0).stops().get(0).id();

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> courseLinkResolver.resolve(null, stopId));
        assertEquals("여행코스를 태그하려면 일자를 함께 선택해야 합니다.", exception.getMessage());
    }

    // T-4: 서로 다른 일자의 dayId/stopId 조합(소속 불일치)이면 400.
    @Test
    void resolveWithMismatchedDayAndStopThrows() {
        TourCourseResponse course = createTwoDayCourse();
        Long day1Id = course.days().get(0).id();
        Long day2StopId = course.days().get(1).stops().get(0).id();

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> courseLinkResolver.resolve(day1Id, day2StopId));
        assertEquals("선택한 경유지가 해당 일자 소속이 아닙니다.", exception.getMessage());
    }

    // T-5: 존재하지 않는 dayId는 400.
    @Test
    void resolveWithUnknownDayIdThrows() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> courseLinkResolver.resolve(Long.MAX_VALUE, null));
        assertEquals("존재하지 않는 여행코스 일자입니다.", exception.getMessage());
    }

    // 존재하지 않는 stopId도 같은 방식으로 400이어야 한다(방어적 검증, 설계 §8 표).
    @Test
    void resolveWithUnknownStopIdThrows() {
        TourCourseResponse course = createTwoDayCourse();
        Long dayId = course.days().get(0).id();

        assertThrows(IllegalArgumentException.class,
                () -> courseLinkResolver.resolve(dayId, Long.MAX_VALUE));
    }
}
