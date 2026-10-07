package kr.co.mycom.travel_korea.feed;

import kr.co.mycom.travel_korea.feed.domain.FeedPost;
import kr.co.mycom.travel_korea.feed.dto.FeedCreateRequest;
import kr.co.mycom.travel_korea.feed.dto.FeedPostResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedTimelineResponse;
import kr.co.mycom.travel_korea.feed.repository.FeedPostRepository;
import kr.co.mycom.travel_korea.feed.service.FeedService;
import kr.co.mycom.travel_korea.tourcourse.domain.StopType;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseDayRequest;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseResponse;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseSaveRequest;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseStopRequest;
import kr.co.mycom.travel_korea.tourcourse.repository.TourCourseRepository;
import kr.co.mycom.travel_korea.tourcourse.service.TourCourseAdminService;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * tour-course-feed-linking 설계 §11.1 — 백엔드 신규 로직 통합 테스트.
 *
 * FeedTimelineCursorTest/TourCourseAdminServiceTest와 같은 스타일로 MockMvc 없이
 * 서비스와 리포지토리를 직접 호출한다(설계 §11 "새 의존성 금지" 원칙 계승).
 *
 * T-6·T-7(참조 무결성, ON DELETE SET NULL)은 이 설계의 핵심 검증 포인트다 — 코드
 * 리뷰만으로는 확신할 수 없어 반드시 FK를 지원하는 테스트 DB(H2, src/test/resources/schema.sql로
 * 운영과 동일한 FK + ON DELETE SET NULL을 보강)로 확인해야 한다(설계 §11.1).
 */
@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class FeedCourseLinkIntegrationTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private FeedPostRepository feedPostRepository;
    @Autowired
    private FeedService feedService;
    @Autowired
    private TourCourseAdminService tourCourseAdminService;
    @Autowired
    private TourCourseRepository tourCourseRepository;

    private UserEntity createUser(String email, String nickname) {
        String suffix = java.util.UUID.randomUUID().toString().substring(0, 8);
        UserEntity user = new UserEntity(email.replace("@test.com", "-" + suffix + "@test.com"), passwordEncoder.encode("Passw0rd!1"), nickname + "-" + suffix, "user");
        return userRepository.save(user);
    }

    private TourCourseStopRequest customStop(int sortOrder, String name) {
        return new TourCourseStopRequest(null, sortOrder, StopType.CUSTOM, null, null, name, "제주 구좌읍", null, null);
    }

    private TourCourseResponse createTwoDayCourse(String title) {
        TourCourseDayRequest day1 = new TourCourseDayRequest(null, 1, List.of(
                customStop(1, "성산일출봉"),
                customStop(2, "동네 해녀식당")
        ));
        TourCourseDayRequest day2 = new TourCourseDayRequest(null, 2, List.of(
                customStop(1, "협재 해수욕장")
        ));

        return tourCourseAdminService.create(new TourCourseSaveRequest(title, "가족여행", List.of(day1, day2)));
    }

    private FeedCreateRequest requestWithCourseLink(String content, Long dayId, Long stopId) {
        return new FeedCreateRequest(content, null, null, null, null, null, null, dayId, stopId, "PUBLIC", null);
    }

    // T-1: linkedCourseDayId만 지정하면 서버가 courseId/courseTitle/dayNumber를 채우고 stopId/stopName은 null이다.
    @Test
    void createWithDayOnlyFillsCourseFieldsAndLeavesStopNull() {
        UserEntity author = createUser("course-link-day-only@test.com", "작성자1");
        TourCourseResponse course = createTwoDayCourse("코스링크 일자단위 테스트");
        Long dayId = course.days().get(0).id();

        FeedPostResponse response = feedService.create(author.getEmail(), requestWithCourseLink("1일차 다녀왔어요", dayId, null), null);

        assertNotNull(response.linkedCourse());
        assertEquals(course.id(), response.linkedCourse().courseId());
        assertEquals(course.title(), response.linkedCourse().courseTitle());
        assertEquals(dayId, response.linkedCourse().dayId());
        assertEquals(1, response.linkedCourse().dayNumber());
        assertNull(response.linkedCourse().stopId());
        assertNull(response.linkedCourse().stopName());
    }

    // T-2: linkedCourseDayId + linkedCourseStopId(정상 소속)면 모든 참조 필드가 채워진다.
    @Test
    void createWithDayAndStopFillsAllLinkedFields() {
        UserEntity author = createUser("course-link-day-stop@test.com", "작성자2");
        TourCourseResponse course = createTwoDayCourse("코스링크 경유지단위 테스트");
        Long dayId = course.days().get(0).id();
        Long stopId = course.days().get(0).stops().get(0).id();

        FeedPostResponse response = feedService.create(author.getEmail(), requestWithCourseLink("성산일출봉 다녀왔어요", dayId, stopId), null);

        assertNotNull(response.linkedCourse());
        assertEquals(course.id(), response.linkedCourse().courseId());
        assertEquals(dayId, response.linkedCourse().dayId());
        assertEquals(stopId, response.linkedCourse().stopId());
        assertEquals("성산일출봉", response.linkedCourse().stopName());
    }

    // 미태그 게시물은 linkedCourse가 null이어야 한다(기존 게시물과 동일한 회귀 없는 상태).
    @Test
    void createWithoutCourseLinkLeavesLinkedCourseNull() {
        UserEntity author = createUser("course-link-none@test.com", "작성자3");

        FeedPostResponse response = feedService.create(author.getEmail(), requestWithCourseLink("코스 태그 없이 작성", null, null), null);

        assertNull(response.linkedCourse());
    }

    // 일자 없이 경유지만 보내면 FeedService.create 레벨에서도 400으로 거부된다(서버 방어, 설계 §8).
    @Test
    void createWithStopOnlyThrows() {
        UserEntity author = createUser("course-link-stop-only@test.com", "작성자4");
        TourCourseResponse course = createTwoDayCourse("코스링크 거부 테스트");
        Long stopId = course.days().get(0).stops().get(0).id();

        assertThrows(IllegalArgumentException.class,
                () -> feedService.create(author.getEmail(), requestWithCourseLink("잘못된 조합", null, stopId), null));
    }

    // T-6: 참조 중인 경유지를 관리자가 update()(구조 교체)로 삭제해도 코스 수정 자체는 성공하고,
    // 해당 게시물의 linked_course_stop_id만 NULL로 바뀌며 linked_course_day_id는 유지된다.
    @Test
    void pruningReferencedStopSetsOnlyStopIdNull() {
        UserEntity author = createUser("course-link-prune-stop@test.com", "작성자5");
        TourCourseResponse course = createTwoDayCourse("코스링크 경유지 프루닝 테스트");
        Long dayId = course.days().get(0).id();
        Long keptStopId = course.days().get(0).stops().get(0).id();
        Long prunedStopId = course.days().get(0).stops().get(1).id();

        FeedPostResponse created = feedService.create(author.getEmail(),
                requestWithCourseLink("동네 해녀식당 다녀왔어요", dayId, prunedStopId), null);

        // 구조 교체 요청에 prunedStopId를 다시 포함하지 않아 pruneUnreferenced가 제거하게 만든다.
        TourCourseDayRequest keepOnlyFirstStop = new TourCourseDayRequest(dayId, 1, List.of(
                new TourCourseStopRequest(keptStopId, 1, StopType.CUSTOM, null, null, "성산일출봉", "제주 구좌읍", null, null)
        ));
        TourCourseSaveRequest updateRequest = new TourCourseSaveRequest(course.title(), "가족여행", List.of(keepOnlyFirstStop));

        // 코스 관리자 작업 자체는 예외 없이 성공해야 한다(ON DELETE SET NULL 덕분에 RESTRICT로 막히지 않음).
        assertDoesNotThrow(() -> tourCourseAdminService.update(course.id(), updateRequest));

        FeedPost reloaded = feedPostRepository.findById(created.id()).orElseThrow();
        assertNull(reloaded.getLinkedCourseStopId(), "삭제된 경유지 참조는 NULL로 끊어져야 한다");
        assertEquals(dayId, reloaded.getLinkedCourseDayId(), "일자 참조는 그대로 유지돼야 한다");
        assertEquals(course.id(), reloaded.getLinkedCourseId());
        // 스냅샷 텍스트는 FK가 아니므로 삭제 영향을 받지 않고 그대로 남는다.
        assertEquals("동네 해녀식당", reloaded.getLinkedCourseStopName());
    }

    // T-7: 참조 중인 코스를 관리자가 delete()로 전체 삭제해도 삭제 자체는 성공하고(예외 없음),
    // 세 참조 id가 모두 NULL이 되지만 스냅샷 텍스트는 유지된다.
    @Test
    void deletingReferencedCourseNullsAllLinkIdsButKeepsSnapshot() {
        UserEntity author = createUser("course-link-delete-course@test.com", "작성자6");
        TourCourseResponse course = createTwoDayCourse("코스링크 전체삭제 테스트");
        Long dayId = course.days().get(0).id();
        Long stopId = course.days().get(0).stops().get(0).id();

        FeedPostResponse created = feedService.create(author.getEmail(),
                requestWithCourseLink("성산일출봉 다녀왔어요", dayId, stopId), null);

        assertDoesNotThrow(() -> tourCourseAdminService.delete(course.id()));
        assertTrue(tourCourseRepository.findById(course.id()).isEmpty());

        FeedPost reloaded = feedPostRepository.findById(created.id()).orElseThrow();
        assertNull(reloaded.getLinkedCourseId());
        assertNull(reloaded.getLinkedCourseDayId());
        assertNull(reloaded.getLinkedCourseStopId());
        assertEquals(course.title(), reloaded.getLinkedCourseTitle());
        assertEquals(1, reloaded.getLinkedCourseDayNumber());
        assertEquals("성산일출봉", reloaded.getLinkedCourseStopName());

        // API 레벨(FeedPostResponse)에서도 스냅샷이 사라지지 않아야 한다(code review Must Fix:
        // hasCourseLink()가 FK 컬럼만 보면 코스 삭제 시 linkedCourse 전체가 null이 되어버리는 문제).
        FeedPostResponse reloadedResponse = feedService.getOne(created.id(), author.getEmail());
        assertNotNull(reloadedResponse.linkedCourse(), "코스가 삭제돼도 스냅샷 텍스트가 남아있다면 linkedCourse는 null이 아니어야 한다");
        assertNull(reloadedResponse.linkedCourse().courseId());
        assertNull(reloadedResponse.linkedCourse().dayId());
        assertNull(reloadedResponse.linkedCourse().stopId());
        assertEquals(course.title(), reloadedResponse.linkedCourse().courseTitle());
        assertEquals(1, reloadedResponse.linkedCourse().dayNumber());
        assertEquals("성산일출봉", reloadedResponse.linkedCourse().stopName());
    }

    // T-8/T-9: linkedCourseId로 필터링하면 그 코스를 참조한 게시물만 반환하고,
    // linkedCourseId 없이 호출하는 기존 메인 피드는 기존 동작과 완전히 동일해야 한다(회귀 방지).
    @Test
    void getFeedFiltersByLinkedCourseIdWithoutAffectingMainTimeline() {
        UserEntity author = createUser("course-link-filter@test.com", "작성자7");
        TourCourseResponse courseA = createTwoDayCourse("코스링크 필터 A");
        TourCourseResponse courseB = createTwoDayCourse("코스링크 필터 B");
        Long dayAId = courseA.days().get(0).id();
        Long dayBId = courseB.days().get(0).id();

        FeedPostResponse linkedToA = feedService.create(author.getEmail(), requestWithCourseLink("A코스 다녀옴", dayAId, null), null);
        feedService.create(author.getEmail(), requestWithCourseLink("B코스 다녀옴", dayBId, null), null);
        FeedPostResponse unlinked = feedService.create(author.getEmail(), requestWithCourseLink("코스 태그 없음", null, null), null);

        FeedTimelineResponse filtered = feedService.getFeed(null, null, 50, courseA.id());
        assertTrue(filtered.posts().stream().anyMatch(p -> p.id().equals(linkedToA.id())));
        assertTrue(filtered.posts().stream().allMatch(p -> p.linkedCourse() != null && courseA.id().equals(p.linkedCourse().courseId())));
        assertTrue(filtered.posts().stream().noneMatch(p -> p.id().equals(unlinked.id())));

        // 기존 3-인자 오버로드(=linkedCourseId 없이 호출)는 4-인자 메서드에 null을 그대로
        // 넘기는 위임이라 기존 메인 피드 동작과 완전히 동일하다(FeedTimelineCursorTest 회귀 없음).
        FeedTimelineResponse mainTimeline = feedService.getFeed(null, null, 50);
        assertTrue(mainTimeline.posts().stream().anyMatch(p -> p.id().equals(unlinked.id())));
        assertTrue(mainTimeline.posts().stream().anyMatch(p -> p.id().equals(linkedToA.id())));
    }
}
