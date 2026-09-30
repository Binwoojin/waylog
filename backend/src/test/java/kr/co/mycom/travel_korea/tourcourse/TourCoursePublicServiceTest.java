package kr.co.mycom.travel_korea.tourcourse;

import kr.co.mycom.travel_korea.board.dto.PageResponse;
import kr.co.mycom.travel_korea.tourcourse.domain.StopType;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseDayRequest;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCoursePublicListItemResponse;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseResponse;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseSaveRequest;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseStopRequest;
import kr.co.mycom.travel_korea.tourcourse.service.TourCourseAdminService;
import kr.co.mycom.travel_korea.tourcourse.service.TourCoursePublicService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * tour-course-list-integration 설계 §4.2, §4.1 — 공개 여행코스 조회 API 회귀 테스트.
 *
 * TourCourseAdminServiceTest와 같은 스타일로 MockMvc 없이 서비스를 직접 호출한다.
 * 테스트 데이터는 관리자 서비스(TourCourseAdminService)로 생성하고, 검증은 공개
 * 서비스(TourCoursePublicService)로 수행해 두 서비스가 같은 DB 위에서 올바르게
 * 연동되는지(집계 쿼리 포함) 확인한다.
 */
@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class TourCoursePublicServiceTest {

    @Autowired
    private TourCourseAdminService tourCourseAdminService;
    @Autowired
    private TourCoursePublicService tourCoursePublicService;

    private TourCourseStopRequest referenceStop(int sortOrder, String name, String address) {
        return new TourCourseStopRequest(null, sortOrder, StopType.REFERENCE, "126508", 12, name, address, null, null);
    }

    private TourCourseStopRequest customStop(int sortOrder, String name, String address) {
        return new TourCourseStopRequest(null, sortOrder, StopType.CUSTOM, null, null, name, address, null, null);
    }

    private TourCourseSaveRequest twoDayRequest(String title) {
        TourCourseDayRequest day1 = new TourCourseDayRequest(null, 1, List.of(
                referenceStop(1, "성산일출봉", "제주 서귀포시 성산읍"),
                customStop(2, "동네 해녀식당", "제주 서귀포시 해녀길")
        ));
        TourCourseDayRequest day2 = new TourCourseDayRequest(null, 2, List.of(
                customStop(1, "협재 해수욕장", "제주 제주시 한림읍")
        ));

        return new TourCourseSaveRequest(title, "가족여행", List.of(day1, day2));
    }

    // 목록 응답에 일자 수·경유지 수·1일차 대표 주소가 포함돼야 한다(계획 FR-01, 설계 §3.2).
    @Test
    void listIncludesDayCountStopCountAndRepresentativeAddress() {
        TourCourseResponse created = tourCourseAdminService.create(twoDayRequest("공개 목록 테스트 코스"));

        PageResponse<TourCoursePublicListItemResponse> page =
                tourCoursePublicService.list("공개 목록 테스트 코스", 0, 10);

        assertEquals(1, page.content().size());
        TourCoursePublicListItemResponse item = page.content().get(0);
        assertEquals(created.id(), item.id());
        assertEquals("공개 목록 테스트 코스", item.title());
        assertEquals(2, item.dayCount());
        assertEquals(3, item.stopCount());
        assertEquals("제주 서귀포시 성산읍", item.representativeAddress());
    }

    // 키워드로 검색되지 않으면 목록에 나타나지 않는다(관리자 search()를 그대로 재사용하는지 확인).
    @Test
    void listFiltersByKeyword() {
        tourCourseAdminService.create(twoDayRequest("검색 안 되는 코스 A"));

        PageResponse<TourCoursePublicListItemResponse> page =
                tourCoursePublicService.list("존재하지-않는-키워드", 0, 10);

        assertTrue(page.content().stream().noneMatch(item -> item.title().equals("검색 안 되는 코스 A")));
    }

    // 상세 응답은 관리자 상세와 같은 중첩 구조(일자-경유지-이미지)를 그대로 내려준다(설계 §4.1).
    @Test
    void getOneReturnsNestedStructure() {
        TourCourseResponse created = tourCourseAdminService.create(twoDayRequest("공개 상세 테스트 코스"));

        TourCourseResponse detail = tourCoursePublicService.getOne(created.id());

        assertEquals(created.id(), detail.id());
        assertEquals(2, detail.days().size());
        assertEquals(2, detail.days().get(0).stops().size());
        assertEquals(StopType.REFERENCE, detail.days().get(0).stops().get(0).stopType());
        assertEquals(StopType.CUSTOM, detail.days().get(1).stops().get(0).stopType());
    }

    // 없는 id는 관리자 상세와 같은 컨벤션(IllegalArgumentException -> GlobalExceptionHandler가 400)을 따른다.
    @Test
    void getOneWithUnknownIdThrows() {
        assertThrows(IllegalArgumentException.class, () -> tourCoursePublicService.getOne(Long.MAX_VALUE));
    }

    // 1일차에 경유지가 없는 코스는 대표 주소가 null이어야 한다(fail-closed, 빈 정보를 억지로 채우지 않음).
    @Test
    void listWithNoFirstDayStopHasNullRepresentativeAddress() {
        TourCourseSaveRequest request = new TourCourseSaveRequest(
                "대표 주소 없는 코스", "테마",
                List.of(new TourCourseDayRequest(null, 1, List.of(customStop(1, "이름만 있는 장소", null))))
        );
        tourCourseAdminService.create(request);

        PageResponse<TourCoursePublicListItemResponse> page =
                tourCoursePublicService.list("대표 주소 없는 코스", 0, 10);

        assertEquals(1, page.content().size());
        assertNull(page.content().get(0).representativeAddress());
    }
}
