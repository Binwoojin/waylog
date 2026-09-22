package kr.co.mycom.travel_korea.user.controller;

import com.nimbusds.jose.JOSEException;

import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.dto.MailRequest;
import kr.co.mycom.travel_korea.user.dto.UserRequest;
import kr.co.mycom.travel_korea.user.service.AuthService;
import kr.co.mycom.travel_korea.user.service.UserService;
import lombok.RequiredArgsConstructor;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@Slf4j
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService service;
    private final UserService userService;

    @PostMapping("/signup")
    public ResponseEntity<Map<String, Object>> signup(@RequestBody UserRequest request) {
        UserEntity user = service.signup(request);
        /*
         * 비밀번호 해시가 포함된 UserEntity 전체를 그대로 반환하면 안 되므로
         * 화면에 필요한 안전한 회원 정보만 전달합니다. (login()과 동일한 방식)
         */
        return ResponseEntity.ok(Map.of(
                "memberId", user.getId(),
                "email", user.getEmail(),
                "nickname", user.getNickname(),
                "role", user.getGrade()
        ));
    }

    @PostMapping("/login")
    public ResponseEntity login(@RequestBody UserRequest request) throws JOSEException {
        return service.login(request);
    }

    @PostMapping("/logout")
    public ResponseEntity<String> logout() {
          ResponseCookie cookie = service.logout();
        return ResponseEntity.ok()
                 .header("Set-Cookie", cookie.toString())
                .body("로그아웃이 정상적으로 처리되었습니다.");
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @CookieValue(name = "refreshToken", required = false) String refreshToken) {
        return service.refreshToken(refreshToken);
    }

    @PostMapping("/email-verification")
    public void sendMessage(@RequestBody UserRequest request){
        service.sendCodeToEmail(request.getEmail());
    }

    @PostMapping("/email-verification/confirm")
    public ResponseEntity verificationEmail(@RequestBody MailRequest request) {
        ResponseEntity response = service.emailVerificationConfirm(request);
        return response;
    }

    @PostMapping("/password-reset-requests")
    public void sendPasswordResetMessage(@RequestBody UserRequest request){
        service.sendCodeToEmail(request.getEmail());
    }

    @PutMapping("/password")
    public void changePassword(@RequestBody UserRequest request) {
         service.changePassword(request);
    }
}
