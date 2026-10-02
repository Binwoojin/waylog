package kr.co.mycom.travel_korea.tour.controller;

import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.tour.bookmark.service.TourBookmarkService;
import kr.co.mycom.travel_korea.tour.dto.response.TourDetailResponse;
import kr.co.mycom.travel_korea.tour.service.TourDetailService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/tour/contents")
public class TourDetailController {

    private final TourDetailService tourDetailService;
    private final TourBookmarkService tourBookmarkService;
    private final JwtConfig jwtConfig;

    /**
     * 관광지·문화시설·여행 즐기기 콘텐츠의 통합 상세 조회 API입니다.
     *
     * 비로그인 사용자도 호출할 수 있습니다(SecurityConfig GET permitAll). 응답의
     * bookmarked는 로그인 사용자가 이 콘텐츠를 북마크했는지를 나타내며, 비로그인이면
     * 항상 false입니다. tourDetailService.getDetail()은 사용자 구분 없이 캐시되므로
     * (withBookmarked 주석 참고) 북마크 여부는 캐시 결과를 받은 뒤 이 컨트롤러에서
     * 요청별로 덮어씁니다.
     */
    @GetMapping("/{contentId}")
    public ResponseEntity<TourDetailResponse> getDetail(
            @PathVariable String contentId,
            @RequestParam Integer contentTypeId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) {
        TourDetailResponse detail = tourDetailService.getDetail(contentId, contentTypeId);
        String email = extractOptionalEmail(authorization);
        boolean bookmarked = tourBookmarkService.isBookmarked(email, contentId, contentTypeId);

        return ResponseEntity.ok(detail.withBookmarked(bookmarked));
    }

    /**
     * FeedController.extractOptionalEmail과 같은 원칙입니다: Authorization 헤더가 아예 없으면
     * 비로그인으로 보고 null을 돌려주지만(permitAll 유지), 헤더는 있는데 토큰이 잘못됐거나
     * 만료됐으면 예외를 던져 400으로 안내합니다.
     */
    private String extractOptionalEmail(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return null;
        }

        String accessToken = authorization.substring("Bearer ".length()).trim();

        try {
            return jwtConfig.validateAccessToken(accessToken);
        } catch (Exception exception) {
            throw new IllegalArgumentException("유효하지 않거나 만료된 토큰입니다.");
        }
    }
}
