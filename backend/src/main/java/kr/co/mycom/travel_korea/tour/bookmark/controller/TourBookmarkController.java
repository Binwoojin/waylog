package kr.co.mycom.travel_korea.tour.bookmark.controller;

import jakarta.validation.Valid;
import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.tour.bookmark.domain.TourBookmarkGroup;
import kr.co.mycom.travel_korea.tour.bookmark.dto.TourBookmarkResponse;
import kr.co.mycom.travel_korea.tour.bookmark.dto.TourBookmarkToggleRequest;
import kr.co.mycom.travel_korea.tour.bookmark.dto.TourBookmarkToggleResponse;
import kr.co.mycom.travel_korea.tour.bookmark.service.TourBookmarkService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/tour-bookmarks")
public class TourBookmarkController {

    private final TourBookmarkService tourBookmarkService;
    private final JwtConfig jwtConfig;

    /**
     * 같은 요청을 다시 보내면 저장/해제가 번갈아 수행되는 토글 API입니다.
     */
    @PostMapping("/toggle")
    public ResponseEntity<TourBookmarkToggleResponse> toggleBookmark(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @Valid @RequestBody TourBookmarkToggleRequest request
    ) {
        String email = extractRequiredEmail(authorization);

        return ResponseEntity.ok(
                tourBookmarkService.toggle(email, request)
        );
    }

    /**
     * 내 북마크 목록을 여행지 또는 여행 즐기기 탭 기준으로 조회합니다.
     *
     * 예: GET /api/v1/tour-bookmarks?group=DESTINATION&page=1&size=9
     */
    @GetMapping
    public ResponseEntity<Page<TourBookmarkResponse>> getMyBookmarks(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @RequestParam TourBookmarkGroup group,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "9") int size
    ) {
        String email = extractRequiredEmail(authorization);

        return ResponseEntity.ok(
                tourBookmarkService.getMyBookmarks(email, group, page, size)
        );
    }

    private String extractRequiredEmail(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }

        String accessToken =
                authorization.substring("Bearer ".length()).trim();

        try {
            return jwtConfig.validateAccessToken(accessToken);
        } catch (Exception exception) {
            throw new IllegalArgumentException(
                    "유효하지 않거나 만료된 토큰입니다."
            );
        }
    }
}