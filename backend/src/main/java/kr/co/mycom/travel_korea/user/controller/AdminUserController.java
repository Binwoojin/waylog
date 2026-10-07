package kr.co.mycom.travel_korea.user.controller;

import kr.co.mycom.travel_korea.board.dto.PageResponse;
import kr.co.mycom.travel_korea.user.dto.UserAdminResponse;
import kr.co.mycom.travel_korea.user.dto.UserGradeUpdateRequest;
import kr.co.mycom.travel_korea.user.dto.UserSuspensionRequest;
import kr.co.mycom.travel_korea.user.service.UserAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

/**
 * 관리자 회원 관리 API.
 *
 * Design Ref: admin-dashboard 설계 §4.1. 인가는 SecurityConfig의
 * "/api/v1/admin/**" -> ROLE_ADMIN 규칙을 그대로 상속한다(새 설정 불필요).
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin/users")
public class AdminUserController {

    private final UserAdminService service;

    @GetMapping("/{id}")
    public UserAdminResponse getOne(@PathVariable Long id) {
        return service.getOne(id);
    }

    @GetMapping
    public PageResponse<UserAdminResponse> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return service.list(keyword, page, size);
    }

    @PatchMapping("/{id}/grade")
    public UserAdminResponse updateGrade(@PathVariable Long id, @RequestBody UserGradeUpdateRequest request) {
        return service.updateGrade(id, currentAdminEmail(), request.grade());
    }

    @PatchMapping("/{id}/suspension")
    public UserAdminResponse suspend(@PathVariable Long id, @Valid @RequestBody UserSuspensionRequest request) {
        return service.suspend(id, currentAdminEmail(), request.days(), request.reason());
    }

    @DeleteMapping("/{id}/suspension")
    public UserAdminResponse liftSuspension(@PathVariable Long id) {
        return service.liftSuspension(id, currentAdminEmail());
    }

    /*
     * 자기 자신 대상 여부 판정은 요청 본문이 아니라 JwtAuthenticationFilter가
     * 심어둔 SecurityContext의 이메일을 사용한다(CommentController와 같은 패턴).
     */
    private String currentAdminEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }
        return authentication.getName();
    }
}
