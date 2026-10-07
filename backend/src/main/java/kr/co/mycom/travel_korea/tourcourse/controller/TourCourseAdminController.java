package kr.co.mycom.travel_korea.tourcourse.controller;

import jakarta.validation.Valid;
import kr.co.mycom.travel_korea.board.dto.PageResponse;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseListItemResponse;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseResponse;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseSaveRequest;
import kr.co.mycom.travel_korea.tourcourse.service.TourCourseAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 관리자 여행코스 관리 API.
 *
 * Design Ref: admin-dashboard 설계 §4.1. 인가는 SecurityConfig의
 * "/api/v1/admin/**" -> ROLE_ADMIN 규칙을 그대로 상속한다(새 설정 불필요).
 *
 * 구조(코스/일자/경유지) 저장과 이미지 첨부는 2단계로 분리한다(설계 §3.3.4):
 * POST/PUT은 구조만 JSON으로 주고받고, 이미지는 멀티파트 하위 엔드포인트로만 다룬다.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin/courses")
public class TourCourseAdminController {

    private final TourCourseAdminService tourCourseAdminService;

    @GetMapping
    public PageResponse<TourCourseListItemResponse> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return tourCourseAdminService.list(keyword, page, size);
    }

    @GetMapping("/{id}")
    public TourCourseResponse getOne(@PathVariable Long id) {
        return tourCourseAdminService.getOne(id);
    }

    @PostMapping
    public ResponseEntity<TourCourseResponse> create(@Valid @RequestBody TourCourseSaveRequest request) {
        TourCourseResponse response = tourCourseAdminService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    public TourCourseResponse update(@PathVariable Long id, @Valid @RequestBody TourCourseSaveRequest request) {
        return tourCourseAdminService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        tourCourseAdminService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/{id}/stops/{stopId}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TourCourseResponse addStopImages(
            @PathVariable Long id,
            @PathVariable Long stopId,
            @RequestPart("images") List<MultipartFile> images
    ) {
        return tourCourseAdminService.addStopImages(id, stopId, images);
    }

    @DeleteMapping("/{id}/stops/{stopId}/images/{imageId}")
    public TourCourseResponse deleteStopImage(
            @PathVariable Long id,
            @PathVariable Long stopId,
            @PathVariable Long imageId
    ) {
        return tourCourseAdminService.deleteStopImage(id, stopId, imageId);
    }

    @PutMapping(value = "/{id}/cover-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TourCourseResponse replaceCoverImage(
            @PathVariable Long id,
            @RequestPart("image") MultipartFile image
    ) {
        return tourCourseAdminService.replaceCoverImage(id, image);
    }
}
