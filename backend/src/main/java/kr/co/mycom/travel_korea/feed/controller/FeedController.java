package kr.co.mycom.travel_korea.feed.controller;

import jakarta.validation.Valid;
import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.feed.dto.FeedCreateRequest;
import kr.co.mycom.travel_korea.feed.dto.FeedPageResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedPostResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedUpdateRequest;
import kr.co.mycom.travel_korea.feed.service.FeedService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.swing.*;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/feed/posts")
public class FeedController {

    private final FeedService feedService;
    private final JwtConfig jwtConfig;

    @GetMapping
    public ResponseEntity<FeedPageResponse> getFeed(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
                                                    @RequestParam(defaultValue = "1") int page,
                                                    @RequestParam(defaultValue = "10") int size) {
        /*
         * 피드 조회는 비로그인 사용자도 가능하므로
         * 토큰이 없으면 email을 null로 전달합니다.
         */

        String email = extractOptionalEmail(authorization);

        return ResponseEntity.ok(feedService.getFeed(email, page, size));
    }

    @GetMapping("/{postId}")
    public ResponseEntity<FeedPostResponse> getOne(@PathVariable Long postId,
                                                   @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        return ResponseEntity.ok(feedService.getOne(postId, extractOptionalEmail(authorization)));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<FeedPostResponse> create(@RequestHeader(HttpHeaders.AUTHORIZATION) String autorization,
                                                   @Valid @RequestPart("post") FeedCreateRequest request,
                                                   @RequestPart(value = "images", required = false)List<MultipartFile> images) {
        FeedPostResponse response = feedService.create(
                extractRequiredEmail(autorization),
                request,
                images
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // SNS에서는 보통 게시물 수정 기능을 제공하지 않기 때문에 수정 기능은 막아두는 것이 자연스러움
//    @PutMapping("/{postId}")
//    public ResponseEntity<FeedPostResponse> update(@PathVariable Long postId,
//                                                   @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
//                                                   @Valid @RequestBody FeedUpdateRequest request) {
//        return ResponseEntity.ok(feedService.update(postId, extractRequiredEmail(authorization), request));
//    }

    @DeleteMapping("/{postId}")
    public ResponseEntity<Void> delete(@PathVariable Long postId,
                                       @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        feedService.delete(
                postId,
                extractRequiredEmail(authorization)
        );

        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{postId}/likes")
    public ResponseEntity<ToggleResponse> toggleLike(@PathVariable Long postId,
                                                     @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        boolean active = feedService.toggleLike(postId, extractRequiredEmail(authorization));

        return ResponseEntity.ok(new ToggleResponse(active));
    }

    @PostMapping("/{postId}/bookmarks")
    public ResponseEntity<ToggleResponse> toggleBookmark(@PathVariable Long postId,
                                                         @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        boolean active = feedService.toggleBookmark(postId, extractRequiredEmail(authorization));

        return ResponseEntity.ok(new ToggleResponse(active));
    }

    private String extractRequiredEmail(String  authorization) {
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

    /*
     * 좋아요·북마크 토글 결과를 공통 형식으로 반환합니다.
     * active=true면 설정된 상태, false면 해제된 상태입니다.
     */
    public record ToggleResponse(boolean active) {}
}
