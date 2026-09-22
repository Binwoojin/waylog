package kr.co.mycom.travel_korea.feed.controller;

import jakarta.validation.Valid;
import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentRequest;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentResponse;
import kr.co.mycom.travel_korea.feed.service.FeedCommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/feed")
public class FeedCommentController {

    private final FeedCommentService feedCommentService;
    private final JwtConfig jwtConfig;

    @GetMapping("/posts/{postId}/comments")
    public ResponseEntity<List<FeedCommentResponse>> list(
            @PathVariable Long postId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) {
        return ResponseEntity.ok(feedCommentService.list(postId, extractOptionalEmail(authorization)));
    }

    @PostMapping("/posts/{postId}/comments")
    public ResponseEntity<FeedCommentResponse> create(
            @PathVariable Long postId,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @Valid @RequestBody FeedCommentRequest request
    ) {
        FeedCommentResponse response = feedCommentService.create(postId, extractRequiredEmail(authorization), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/comments/{commentId}")
    public ResponseEntity<FeedCommentResponse> update(
            @PathVariable Long commentId,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @Valid @RequestBody FeedCommentRequest request
    ) {
        return ResponseEntity.ok(feedCommentService.update(commentId, extractRequiredEmail(authorization), request));
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Void> delete(
            @PathVariable Long commentId,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization
    ) {
        feedCommentService.delete(commentId, extractRequiredEmail(authorization));
        return ResponseEntity.noContent().build();
    }

    private String extractRequiredEmail(String authorization) {
        String email = extractOptionalEmail(authorization);

        if (email == null) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }

        return email;
    }

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
