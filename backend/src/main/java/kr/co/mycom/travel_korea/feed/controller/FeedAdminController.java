package kr.co.mycom.travel_korea.feed.controller;

import jakarta.validation.Valid;
import kr.co.mycom.travel_korea.feed.dto.FeedAdminDeleteRequest;
import kr.co.mycom.travel_korea.feed.dto.FeedAdminPageResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedAdminPostResponse;
import kr.co.mycom.travel_korea.feed.service.FeedAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

/**
 * 관리자 피드 관리 API.
 *
 * Design Ref: admin-dashboard 설계 §4.1. 인가는 SecurityConfig의
 * "/api/v1/admin/**" -> ROLE_ADMIN 규칙을 그대로 상속한다(새 설정 불필요).
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin/feed/posts")
public class FeedAdminController {

    private final FeedAdminService feedAdminService;

    @GetMapping
    public FeedAdminPageResponse list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return feedAdminService.list(page, size);
    }

    @GetMapping("/{id}")
    public FeedAdminPostResponse getOne(@PathVariable Long id) {
        return feedAdminService.getOne(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @Valid @RequestBody FeedAdminDeleteRequest request) {
        feedAdminService.delete(id, request, currentAdminEmail());
        return ResponseEntity.noContent().build();
    }

    /*
     * 자기 자신 대상 여부 판정은 요청 본문이 아니라 JwtAuthenticationFilter가 심어둔
     * SecurityContext의 이메일을 사용한다(AdminUserController.currentAdminEmail()과 동일한 패턴).
     */
    private String currentAdminEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }
        return authentication.getName();
    }
}
