package kr.co.mycom.travel_korea.feed.controller;

import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.feed.dto.FeedBookmarkPageResponse;
import kr.co.mycom.travel_korea.feed.service.FeedService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/*
 * mypage-bookmarks 설계 §4.5(Q-5, Q-7): 내 피드 북마크 목록 조회.
 *
 * FeedController의 "/api/v1/feed/posts/{postId}" 경로와 겹치지 않도록
 * 별도 컨트롤러로 분리한다.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/feed/bookmarks")
public class FeedBookmarkController {

    private final FeedService feedService;
    private final JwtConfig jwtConfig;

    @GetMapping
    public ResponseEntity<FeedBookmarkPageResponse> getMyBookmarks(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "12") int size) {
        return ResponseEntity.ok(feedService.getMyBookmarks(extractRequiredEmail(authorization), page, size));
    }

    private String extractRequiredEmail(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }

        String accessToken = authorization.substring("Bearer ".length()).trim();

        try {
            return jwtConfig.validateAccessToken(accessToken);
        } catch (Exception exception) {
            throw new IllegalArgumentException("유효하지 않거나 만료된 토큰입니다.");
        }
    }
}
