package kr.co.mycom.travel_korea.user.controller;

import jakarta.validation.Valid;
import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.user.dto.UserWithdrawalRequest;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import kr.co.mycom.travel_korea.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class UserController {
    private final UserService service;
    private final JwtConfig jwtConfig;

    @GetMapping("users/check-email")
    public ResponseEntity<Map<String, Boolean>> checkEmail(@RequestParam("email") String email) {
        /*
         * 이미 존재하면 available=false,
         * 존재하지 않으면 available=true를 반환합니다.
         */
        boolean available = !service.existEmail(email);

        return ResponseEntity.ok(Map.of("available", available));
    }

    @GetMapping("users/check-nickname")
    public ResponseEntity<Map<String, Boolean>> checkNickname(@RequestParam("nickname") String nickname) {

        boolean available = !service.existNickname(nickname);

        return ResponseEntity.ok(Map.of("available", available));
    }

    /**
     * 회원 탈퇴(mypage-bookmarks 설계 §4.4, Q-1). 비밀번호 재확인이 필수이며,
     * 성공 시 리프레시 쿠키를 즉시 만료시켜 프론트가 바로 로그아웃 상태로 전환하게 합니다.
     *
     * 이번 사이클은 "재로그인 차단"까지만 다룹니다(기존 게시물/댓글의 익명화·연쇄 삭제는 범위 밖).
     */
    @DeleteMapping("users/me")
    public ResponseEntity<Void> withdraw(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @Valid @RequestBody UserWithdrawalRequest request) {
        String email = extractRequiredEmail(authorization);
        ResponseCookie expiredCookie = service.withdraw(email, request.password());

        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, expiredCookie.toString())
                .build();
    }

    /*
     * FeedProfileController/TourBookmarkController와 동일한 패턴.
     */
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

