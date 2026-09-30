package kr.co.mycom.travel_korea.tourcourse.controller;

import kr.co.mycom.travel_korea.board.dto.PageResponse;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCoursePublicListItemResponse;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseResponse;
import kr.co.mycom.travel_korea.tourcourse.service.TourCoursePublicService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 비로그인 사용자를 위한 여행코스 공개 조회 API.
 *
 * Design Ref: tour-course-list-integration 설계 §4.1. 인가는 SecurityConfig에
 * "/api/v1/courses", "/api/v1/courses/**"를 GET 한정 permitAll로 추가해 처리한다.
 * 기존 "/api/v1/admin/courses/**"(ROLE_ADMIN)는 변경하지 않는다.
 *
 * 이 컨트롤러는 TourCoursePublicService(읽기 전용)만 의존한다 — 관리자 CRUD 서비스인
 * TourCourseAdminService는 이 컨트롤러에서 참조하지 않는다.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/courses")
public class TourCoursePublicController {

    private final TourCoursePublicService tourCoursePublicService;

    @GetMapping
    public PageResponse<TourCoursePublicListItemResponse> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "9") int size
    ) {
        return tourCoursePublicService.list(keyword, page, size);
    }

    @GetMapping("/{id}")
    public TourCourseResponse getOne(@PathVariable Long id) {
        return tourCoursePublicService.getOne(id);
    }
}
