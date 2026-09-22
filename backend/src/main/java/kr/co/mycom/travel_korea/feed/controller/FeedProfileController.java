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
