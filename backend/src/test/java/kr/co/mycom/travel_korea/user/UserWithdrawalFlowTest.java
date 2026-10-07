package kr.co.mycom.travel_korea.user;

import jakarta.servlet.FilterChain;
import kr.co.mycom.travel_korea.config.JwtAuthenticationFilter;
import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.user.dto.UserRequest;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import kr.co.mycom.travel_korea.user.service.AuthService;
import kr.co.mycom.travel_korea.user.service.UserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * mypage-bookmarks 설계 §3.3, §4.4 — 회원 탈퇴(withdraw) 및 탈퇴 체크포인트 3곳(로그인,
 * 리프레시, JwtAuthenticationFilter) 회귀 테스트.
 *
 * UserSuspensionLoginFlowTest와 같은 스타일로 MockMvc 없이 서비스와 필터를 직접 호출한다.
 */
@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class UserWithdrawalFlowTest {

    private static final String RAW_PASSWORD = "Passw0rd!1";

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private JwtConfig jwtConfig;
    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;
    @Autowired
    private AuthService authService;
    @Autowired
    private UserService userService;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private UserEntity createUser(String email, String nickname) {
        UserEntity user = new UserEntity(email, passwordEncoder.encode(RAW_PASSWORD), nickname, "user");
        return userRepository.save(user);
    }

    private UserRequest loginRequest(String email) {
        UserRequest request = new UserRequest();
        request.setEmail(email);
        request.setPassword(RAW_PASSWORD);
        return request;
    }

    // 비밀번호가 일치하면 탈퇴가 처리되고, 리프레시 쿠키를 즉시 만료시키는 쿠키가 반환된다.
    @Test
    void withdrawWithCorrectPasswordSucceeds() {
        UserEntity user = createUser("withdraw-ok@test.com", "탈퇴예정1");

        ResponseCookie cookie = userService.withdraw(user.getEmail(), RAW_PASSWORD);

        assertEquals(0, cookie.getMaxAge().getSeconds());

        UserEntity reloaded = userRepository.findByEmail(user.getEmail()).orElseThrow();
        assertTrue(reloaded.isWithdrawn());
    }

    // 비밀번호가 틀리면 탈퇴가 진행되지 않아야 한다.
    @Test
    void withdrawWithWrongPasswordThrowsAndDoesNotWithdraw() {
        UserEntity user = createUser("withdraw-wrongpw@test.com", "탈퇴예정2");

        assertThrows(IllegalArgumentException.class, () -> userService.withdraw(user.getEmail(), "WrongPassword!1"));

        UserEntity reloaded = userRepository.findByEmail(user.getEmail()).orElseThrow();
        assertFalse(reloaded.isWithdrawn());
    }

    // 체크포인트 1: 탈퇴한 회원은 로그인 실패(401)와 동일한 메시지로 응답하며 토큰을 받지 못한다.
    @Test
    void withdrawnUserLoginReturns401WithGenericMessage() throws Exception {
        UserEntity user = createUser("withdraw-login@test.com", "탈퇴예정3");
        userService.withdraw(user.getEmail(), RAW_PASSWORD);

        ResponseEntity<?> response = authService.login(loginRequest(user.getEmail()));

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals("이메일 또는 비밀번호가 올바르지 않습니다.", body.get("message"));
        assertNull(body.get("accessToken"));
        // 탈퇴 사실이 노출되지 않아야 한다(정지와 다른 코드/문구가 없어야 함).
        assertNull(body.get("code"));
    }

    // 체크포인트 2: 탈퇴한 회원은 Refresh Token이 유효해도 재발급이 실패(401)해야 한다.
    @Test
    void withdrawnUserRefreshTokenFails() throws Exception {
        UserEntity user = createUser("withdraw-refresh@test.com", "탈퇴예정4");
        JwtConfig.TokenResponse tokens = jwtConfig.createTokenPair(user.getEmail());

        userService.withdraw(user.getEmail(), RAW_PASSWORD);

        ResponseEntity<?> response = authService.refreshToken(tokens.refreshToken());

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    // 체크포인트 3: 탈퇴 적용 이전에 발급된 Access Token은 탈퇴 적용 다음 요청부터 인증되지 않는다.
    @Test
    void withdrawnUserExistingAccessTokenRejectedByFilter() throws Exception {
        UserEntity user = createUser("withdraw-filter@test.com", "탈퇴예정5");
        String accessToken = jwtConfig.createAccessToken(user.getEmail());
        FilterChain noopChain = (req, res) -> {};

        // 탈퇴 전: 인증 정보가 정상적으로 채워져야 한다
        MockHttpServletRequest beforeRequest = new MockHttpServletRequest();
        beforeRequest.addHeader("Authorization", "Bearer " + accessToken);
        jwtAuthenticationFilter.doFilter(beforeRequest, new MockHttpServletResponse(), noopChain);
        Authentication beforeAuth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(beforeAuth);
        assertEquals(user.getEmail(), beforeAuth.getName());
        SecurityContextHolder.clearContext();

        userService.withdraw(user.getEmail(), RAW_PASSWORD);

        // 탈퇴 후: 같은 토큰이어도 인증 정보가 채워지지 않아야 한다
        MockHttpServletRequest afterRequest = new MockHttpServletRequest();
        afterRequest.addHeader("Authorization", "Bearer " + accessToken);
        jwtAuthenticationFilter.doFilter(afterRequest, new MockHttpServletResponse(), noopChain);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    // 회귀 확인: 탈퇴하지 않은 회원은 그대로 로그인할 수 있어야 한다.
    @Test
    void nonWithdrawnUserLoginSucceeds() throws Exception {
        createUser("withdraw-unaffected@test.com", "정상유저9");

        ResponseEntity<?> response = authService.login(loginRequest("withdraw-unaffected@test.com"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
    }
}
