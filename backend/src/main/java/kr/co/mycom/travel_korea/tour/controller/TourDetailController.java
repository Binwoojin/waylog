package kr.co.mycom.travel_korea.tour.controller;

import kr.co.mycom.travel_korea.tour.dto.response.TourDetailResponse;
import kr.co.mycom.travel_korea.tour.service.TourDetailService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/tour/contents")
public class TourDetailController {

    private final TourDetailService tourDetailService;

    /**
     * 관광지·문화시설·여행 즐기기 콘텐츠의 통합 상세 조회 API입니다.
     */
    @GetMapping("/{contentId}")
    public ResponseEntity<TourDetailResponse> getDetail(@PathVariable String contentId,
                                                        @RequestParam Integer contentTypeId) {
        return ResponseEntity.ok(tourDetailService.getDetail(contentId, contentTypeId));
    }
}
