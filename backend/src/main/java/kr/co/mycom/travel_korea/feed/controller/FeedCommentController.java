package kr.co.mycom.travel_korea.feed.controller;

import jakarta.validation.Valid;
import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentCreateRequest;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentDeleteResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentPageResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentResponse;
import kr.co.mycom.travel_korea.feed.service.FeedCommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * feed-comment-integration 설계 §4.2 — 댓글 CRUD 전용 컨트롤러.
 *
 * GET은 SecurityConfig의 기존 "/api/v1/feed/posts/**" GET permitAll 규칙에 이미
 * 포함되어 비로그인 조회가 가능하다(설계 §4.4, D-5). POST/DELETE는 별도 규칙이
 * 없어 anyRequest().authenticated()로 자동 인증이 요구된다. 이번 사이클에서
 * SecurityConfig.java는 수정하지 않는다.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/feed/posts/{postId}/comments")
public class FeedCommentController {

    private final FeedCommentService feedCommentService;
    private final JwtConfig jwtConfig;

    @GetMapping
    public FeedCommentPageResponse list(@PathVariable Long postId,
                                         @RequestParam(defaultValue = "1") int page,
                                         @RequestParam(defaultValue = "20") int size) {
        return feedCommentService.list(postId, page, size);
    }

    @PostMapping
    public ResponseEntity<FeedCommentResponse> create(@PathVariable Long postId,
                                                        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                                        @Valid @RequestBody FeedCommentCreateRequest request) {
        FeedCommentResponse response = feedCommentService.create(postId, extractRequiredEmail(authorization), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // Should Improve — 204 대신 실제 감소량(removedCount)을 응답 본문에 담아 프론트 로컬 state 추정을 대체한다.
    @DeleteMapping("/{commentId}")
    public ResponseEntity<FeedCommentDeleteResponse> delete(@PathVariable Long postId,
                                                              @PathVariable Long commentId,
                                                              @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        long removedCount = feedCommentService.delete(postId, commentId, extractRequiredEmail(authorization));
        return ResponseEntity.ok(new FeedCommentDeleteResponse(removedCount));
    }

    // FeedController와 동일 로직(사이클 1 패턴 복제).
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
