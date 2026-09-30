package kr.co.mycom.travel_korea.feed.controller;

import jakarta.validation.Valid;
import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.feed.dto.FeedProfileResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedProfileUpdateRequest;
import kr.co.mycom.travel_korea.feed.service.FeedProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/feed/profile")
public class FeedProfileController {

    private final FeedProfileService feedProfileService;
    private final JwtConfig jwtConfig;

    /**
     * 내 SNS 프로필 및 내가 작성한 여행 기록을 조회합니다.
     */
    @GetMapping
    public ResponseEntity<FeedProfileResponse> getMyProfile(@RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                                            @RequestParam(defaultValue = "1") int page,
                                                            @RequestParam(defaultValue = "12") int size) {
        return ResponseEntity.ok(feedProfileService.getMyProfile(extractRequiredEmail(authorization), page, size));
    }

    /**
     * feed-integration 설계 §4.4(P-6): 타인의 SNS 프로필과 그가 작성한 PUBLIC 게시물만 조회합니다.
     *
     * 비로그인 사용자도 조회할 수 있는 공개 API입니다("둘러보기" 목적). 좋아요·북마크 여부는
     * 조회자와 무관하게 항상 false로 고정합니다(설계 §4.4 노출 범위 결정).
     *
     * 경로 세그먼트 수가 위 getMyProfile("/api/v1/feed/profile")과 다르므로
     * 스프링이 두 매핑을 올바르게 구분합니다(라우팅 충돌 없음).
     */
    @GetMapping("/{userId}")
    public ResponseEntity<FeedProfileResponse> getUserProfile(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "12") int size) {
        return ResponseEntity.ok(feedProfileService.getUserProfile(userId, page, size));
    }

    /**
     * SNS 전용 @아이디를 수정합니다.
     */
    @PatchMapping
    public ResponseEntity<FeedProfileResponse> updateMyHandle(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @Valid @RequestBody FeedProfileUpdateRequest request) {
        return ResponseEntity.ok(feedProfileService.updateMyHandle(extractRequiredEmail(authorization), request));
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
