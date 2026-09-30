package kr.co.mycom.travel_korea.tourcourse;

import kr.co.mycom.travel_korea.tourcourse.domain.StopType;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseDayRequest;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseResponse;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseSaveRequest;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseStopRequest;
import kr.co.mycom.travel_korea.tourcourse.exception.TourCourseValidationException;
import kr.co.mycom.travel_korea.tourcourse.repository.TourCourseRepository;
import kr.co.mycom.travel_korea.tourcourse.service.TourCourseAdminService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * admin-dashboard 설계 §3.3, §4.1, §6 — 관리자 여행코스 구조 CRUD 회귀 테스트.
 *
 * FeedAdminServiceTest/UserAdminValidationTest와 같은 스타일로 MockMvc 없이 서비스와
 * 리포지토리를 직접 호출한다(§11 "새 의존성 금지"). 이미지 첨부(멀티파트 업로드) 경로는
 * 실제 S3 네트워크 호출이 필요해 FeedAdminServiceTest와 같은 이유로 다루지 않고,
 * 일자당 이미지 10장 제한/파일 검증은 TourCourseImagePolicyTest에서 순수 단위 테스트로
 * 확인한다.
 */
@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class TourCourseAdminServiceTest {

    @Autowired
    private TourCourseAdminService tourCourseAdminService;
    @Autowired
    private TourCourseRepository tourCourseRepository;

    private TourCourseStopRequest referenceStop(Long id, int sortOrder, String name) {
        return new TourCourseStopRequest(id, sortOrder, StopType.REFERENCE, "126508", 12, name, "제주 서귀포시", null, null);
    }

    private TourCourseStopRequest customStop(Long id, int sortOrder, String name) {
        return new TourCourseStopRequest(id, sortOrder, StopType.CUSTOM, null, null, name, "제주 구좌읍", null, null);
    }

    private TourCourseSaveRequest twoDayRequest() {
        TourCourseDayRequest day1 = new TourCourseDayRequest(null, 1, List.of(
                referenceStop(null, 1, "성산일출봉"),
                customStop(null, 2, "동네 해녀식당")
        ));
        TourCourseDayRequest day2 = new TourCourseDayRequest(null, 2, List.of(
                customStop(null, 1, "협재 해수욕장")
        ));

        return new TourCourseSaveRequest("제주 동부 1박2일", "가족여행", List.of(day1, day2));
    }

    @Test
    void createBuildsNestedStructureWithGeneratedIds() {
        TourCourseResponse response = tourCourseAdminService.create(twoDayRequest());

        assertNotNull(response.id());
        assertEquals("제주 동부 1박2일", response.title());
        assertEquals(2, response.days().size());
        assertEquals(2, response.days().get(0).stops().size());
        assertNotNull(response.days().get(0).stops().get(0).id());
        assertEquals(StopType.REFERENCE, response.days().get(0).stops().get(0).stopType());
        assertEquals("126508", response.days().get(0).stops().get(0).tourContentId());
        assertEquals(StopType.CUSTOM, response.days().get(0).stops().get(1).stopType());
        assertTrue(response.days().get(0).stops().get(1).images().isEmpty());
    }

    @Test
    void createWithBlankTitleThrows() {
        TourCourseSaveRequest request = new TourCourseSaveRequest(" ", "가족여행",
                List.of(new TourCourseDayRequest(null, 1, List.of(customStop(null, 1, "장소")))));

        assertThrows(IllegalArgumentException.class, () -> tourCourseAdminService.create(request));
    }

    @Test
    void createWithNoDaysThrows() {
        TourCourseSaveRequest request = new TourCourseSaveRequest("코스", "테마", List.of());

        assertThrows(IllegalArgumentException.class, () -> tourCourseAdminService.create(request));
    }

    @Test
    void createWithDayWithoutStopsThrows() {
        TourCourseSaveRequest request = new TourCourseSaveRequest("코스", "테마",
                List.of(new TourCourseDayRequest(null, 1, List.of())));

        assertThrows(IllegalArgumentException.class, () -> tourCourseAdminService.create(request));
    }

    @Test
    void createWithNonConsecutiveDayNumbersThrows() {
        TourCourseSaveRequest request = new TourCourseSaveRequest("코스", "테마", List.of(
                new TourCourseDayRequest(null, 1, List.of(customStop(null, 1, "장소1"))),
                new TourCourseDayRequest(null, 3, List.of(customStop(null, 1, "장소2")))
        ));

        assertThrows(IllegalArgumentException.class, () -> tourCourseAdminService.create(request));
    }

    @Test
    void createWithDuplicateDayNumbersThrows() {
        TourCourseSaveRequest request = new TourCourseSaveRequest("코스", "테마", List.of(
                new TourCourseDayRequest(null, 1, List.of(customStop(null, 1, "장소1"))),
                new TourCourseDayRequest(null, 1, List.of(customStop(null, 1, "장소2")))
        ));

        assertThrows(IllegalArgumentException.class, () -> tourCourseAdminService.create(request));
    }

    @Test
    void createWithDuplicateSortOrderInSameDayThrows() {
        TourCourseSaveRequest request = new TourCourseSaveRequest("코스", "테마", List.of(
                new TourCourseDayRequest(null, 1, List.of(
                        customStop(null, 1, "장소1"),
                        customStop(null, 1, "장소2")
                ))
        ));

        assertThrows(IllegalArgumentException.class, () -> tourCourseAdminService.create(request));
    }

    // REFERENCE인데 tourContentId/tourContentTypeId가 없으면 400 INVALID_STOP_TYPE (설계 §6)
    @Test
    void createWithReferenceStopMissingTourContentIdThrowsInvalidStopType() {
        TourCourseStopRequest invalidReference = new TourCourseStopRequest(null, 1, StopType.REFERENCE, null, null, "장소", null, null, null);
        TourCourseSaveRequest request = new TourCourseSaveRequest("코스", "테마",
                List.of(new TourCourseDayRequest(null, 1, List.of(invalidReference))));

        TourCourseValidationException exception = assertThrows(TourCourseValidationException.class,
                () -> tourCourseAdminService.create(request));
        assertEquals("INVALID_STOP_TYPE", exception.getCode());
    }

    // CUSTOM인데 tourContentId가 있으면 400 INVALID_STOP_TYPE (설계 §6)
    @Test
    void createWithCustomStopHavingTourContentIdThrowsInvalidStopType() {
        TourCourseStopRequest invalidCustom = new TourCourseStopRequest(null, 1, StopType.CUSTOM, "126508", null, "장소", null, null, null);
        TourCourseSaveRequest request = new TourCourseSaveRequest("코스", "테마",
                List.of(new TourCourseDayRequest(null, 1, List.of(invalidCustom))));

        TourCourseValidationException exception = assertThrows(TourCourseValidationException.class,
                () -> tourCourseAdminService.create(request));
        assertEquals("INVALID_STOP_TYPE", exception.getCode());
    }

    // 수정 시 기존 day/stop id를 그대로 돌려보내면 그 경유지가 유지된다(설계 §4.1 "구조 전체 교체").
    @Test
    void updateKeepingExistingIdsPreservesStop() {
        TourCourseResponse created = tourCourseAdminService.create(twoDayRequest());
        Long dayId = created.days().get(0).id();
        Long keptStopId = created.days().get(0).stops().get(0).id();

        TourCourseDayRequest updatedDay1 = new TourCourseDayRequest(dayId, 1, List.of(
                referenceStop(keptStopId, 1, "성산일출봉(수정)")
        ));
        TourCourseSaveRequest updateRequest = new TourCourseSaveRequest("제주 동부 1박2일(수정)", "커플여행", List.of(updatedDay1));

        TourCourseResponse updated = tourCourseAdminService.update(created.id(), updateRequest);

        assertEquals("제주 동부 1박2일(수정)", updated.title());
        assertEquals(1, updated.days().size());
        assertEquals(1, updated.days().get(0).stops().size());
        assertEquals(keptStopId, updated.days().get(0).stops().get(0).id());
        assertEquals("성산일출봉(수정)", updated.days().get(0).stops().get(0).name());
    }

    // 수정 시 요청에 없는 기존 일자/경유지는 제거된다(orphanRemoval로 DB 행도 정리).
    @Test
    void updateRemovingDayDeletesItsStops() {
        TourCourseResponse created = tourCourseAdminService.create(twoDayRequest());

        TourCourseSaveRequest updateRequest = new TourCourseSaveRequest("제주 동부 당일치기", "가족여행", List.of(
                new TourCourseDayRequest(null, 1, List.of(customStop(null, 1, "새 장소")))
        ));

        TourCourseResponse updated = tourCourseAdminService.update(created.id(), updateRequest);

        assertEquals(1, updated.days().size());

        TourCourseResponse reloaded = tourCourseAdminService.getOne(created.id());
        assertEquals(1, reloaded.days().size());
        assertEquals(1, reloaded.days().get(0).stops().size());
        assertEquals("새 장소", reloaded.days().get(0).stops().get(0).name());
    }

    /*
     * 회귀 테스트(Must Fix 1): 살아있는 두 일자의 dayNumber를 서로 맞바꾸는 저장이
     * (course_id, day_number) 유니크 제약 위반 없이 성공해야 한다.
     * TourCourse.assignTemporaryDayNumbers()가 없으면 이 테스트는
     * DataIntegrityViolationException으로 항상 실패한다.
     */
    @Test
    void updateSwappingDayNumbersSucceeds() {
        TourCourseResponse created = tourCourseAdminService.create(twoDayRequest());

        Long day1Id = created.days().get(0).id();
        Long day1Stop1Id = created.days().get(0).stops().get(0).id();
        Long day1Stop2Id = created.days().get(0).stops().get(1).id();
        Long day2Id = created.days().get(1).id();
        Long day2StopId = created.days().get(1).stops().get(0).id();

        // 기존 1일차(day1Id)는 dayNumber=2로, 기존 2일차(day2Id)는 dayNumber=1로 맞바꾼다.
        TourCourseDayRequest swappedToFirst = new TourCourseDayRequest(day2Id, 1, List.of(
                customStop(day2StopId, 1, "협재 해수욕장")
        ));
        TourCourseDayRequest swappedToSecond = new TourCourseDayRequest(day1Id, 2, List.of(
                referenceStop(day1Stop1Id, 1, "성산일출봉"),
                customStop(day1Stop2Id, 2, "동네 해녀식당")
        ));

        TourCourseSaveRequest swapRequest = new TourCourseSaveRequest("제주 동부 1박2일", "가족여행",
                List.of(swappedToFirst, swappedToSecond));

        TourCourseResponse updated = tourCourseAdminService.update(created.id(), swapRequest);

        assertEquals(2, updated.days().size());
        assertEquals(day2Id, updated.days().get(0).id());
        assertEquals(1, updated.days().get(0).dayNumber());
        assertEquals(day1Id, updated.days().get(1).id());
        assertEquals(2, updated.days().get(1).dayNumber());

        // 재조회 시에도(@OrderBy("dayNumber ASC")로 DB에서 다시 정렬) 맞바뀐 순서가 유지돼야 한다.
        TourCourseResponse reloaded = tourCourseAdminService.getOne(created.id());
        assertEquals(day2Id, reloaded.days().get(0).id());
        assertEquals(1, reloaded.days().get(0).dayNumber());
        assertEquals(day1Id, reloaded.days().get(1).id());
        assertEquals(2, reloaded.days().get(1).dayNumber());
    }

    @Test
    void deleteRemovesCourseAndCascadedRows() {
        TourCourseResponse created = tourCourseAdminService.create(twoDayRequest());
        Long courseId = created.id();

        tourCourseAdminService.delete(courseId);

        assertTrue(tourCourseRepository.findById(courseId).isEmpty());
        assertThrows(IllegalArgumentException.class, () -> tourCourseAdminService.getOne(courseId));
    }

    @Test
    void getOneWithUnknownIdThrows() {
        assertThrows(IllegalArgumentException.class, () -> tourCourseAdminService.getOne(Long.MAX_VALUE));
    }
}
