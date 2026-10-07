package kr.co.mycom.travel_korea.tour.controller;


import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.tour.bookmark.service.TourBookmarkService;
import kr.co.mycom.travel_korea.tour.dto.request.TourSearchRequest;
import kr.co.mycom.travel_korea.tour.dto.response.TourListResponse;
import kr.co.mycom.travel_korea.tour.dto.response.TourSummaryResponse;
import kr.co.mycom.travel_korea.tour.service.TourService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class TourController {
    private final TourService service;
    private final TourBookmarkService tourBookmarkService;
    private final JwtConfig jwtConfig;

    /**
     * 비로그인 사용자도 호출할 수 있습니다(SecurityConfig GET /api/v1/search permitAll).
     * 각 항목의 bookmarked는 로그인 사용자가 해당 콘텐츠를 북마크했는지를 나타내며,
     * 비로그인이면 항상 false입니다. service.getTours()/getToursByRegionGroup()은
     * 사용자 구분 없이 캐시되므로(TourSummaryResponse.withBookmarked 주석 참고) 북마크
     * 여부는 캐시 결과를 받은 뒤 이 컨트롤러에서 페이지당 한 번의 배치 조회로 덮어씁니다.
     */
    @GetMapping("/search")
    public TourListResponse getTours(
            @ModelAttribute TourSearchRequest request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) {
        TourListResponse response;

        if (request.regionGroup() != null && !request.regionGroup().isBlank()) {
            response = service.getToursByRegionGroup(
                    request.page(),
                    request.size(),
                    request.regionGroup(),
                    request.contentTypeId(),
                    request.arrange()
            );
        } else {
            response = service.getTours(
                    request.page(),
                    request.size(),
                    request.lDongRegnCd(),
                    request.lDongSignguCd(),
                    request.contentTypeId(),
                    request.arrange(),
                    request.lclsSystm1(),
                    request.lclsSystm2()
            );
        }

        String email = extractOptionalEmail(authorization);

        return withBookmarked(response, email);
    }

    /**
     * 현재 페이지의 콘텐츠 id를 모아 한 번의 배치 조회로 북마크 여부를 확인합니다(N+1 방지).
     */
    private TourListResponse withBookmarked(TourListResponse response, String email) {
        if (response.items().isEmpty()) {
            return response;
        }

        List<String> contentIds = response.items().stream()
                .map(TourSummaryResponse::contentId)
                .toList();

        Set<String> bookmarkedKeys = tourBookmarkService.findBookmarkedKeys(email, contentIds);

        List<TourSummaryResponse> items = response.items().stream()
                .map(item -> item.withBookmarked(
                        bookmarkedKeys.contains(
                                TourBookmarkService.bookmarkKey(item.contentId(), parseContentTypeId(item.contentTypeId()))
                        )
                ))
                .toList();

        return new TourListResponse(items, response.page(), response.size(), response.totalCount());
    }

    /**
     * TourSummaryResponse.contentTypeId는 TourAPI 원본과 같은 문자열이라(TourDetailResponse의
     * Integer contentTypeId와 다름), 북마크 키 비교를 위해 Integer로 변환합니다.
     * 변환할 수 없으면 null로 두어(어떤 북마크 키와도 일치하지 않음) bookmarked=false가 되게 합니다.
     */
    private Integer parseContentTypeId(String value) {
        try {
            return value == null || value.isBlank() ? null : Integer.valueOf(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    /**
     * FeedController.extractOptionalEmail과 같은 원칙입니다: Authorization 헤더가 아예 없으면
     * 비로그인으로 보고 null을 돌려주지만, 헤더는 있는데 토큰이 잘못됐거나 만료됐으면
     * 예외를 던져 400으로 안내합니다.
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
