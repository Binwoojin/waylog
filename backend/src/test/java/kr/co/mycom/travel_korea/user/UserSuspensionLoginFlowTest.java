package kr.co.mycom.travel_korea.user;

import jakarta.servlet.FilterChain;
import kr.co.mycom.travel_korea.config.JwtAuthenticationFilter;
import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.user.dto.UserRequest;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import kr.co.mycom.travel_korea.user.service.AuthService;
import kr.co.mycom.travel_korea.user.service.UserAdminService;
import kr.co.mycom.travel_korea.user.service.UserSuspensionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * admin-dashboard 설계 §4.2, §9.2 — 회원 활동 정지(기간제 로그인 차단) 3개 체크포인트에 대한
 * 회귀 테스트. AuthService/JwtAuthenticationFilter를 직접 호출해 검증한다.
 *
 * (프로젝트에 spring-boot-starter-test의 웹 MVC 테스트 슬라이스가 없어 MockMvc를 쓰지 않는다.
 *  §11 코딩 규칙 "새 의존성 금지"에 따라 새 테스트 의존성을 추가하지 않았다.)
 */
@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class UserSuspensionLoginFlowTest {

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
    private UserSuspensionService suspensionService;
    @Autowired
    private UserAdminService userAdminService;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private UserEntity createUser(String email, String nickname, String grade) {
        UserEntity user = new UserEntity(email, passwordEncoder.encode(RAW_PASSWORD), nickname, grade);
        return userRepository.save(user);
    }

    private UserRequest loginRequest(String email) {
        UserRequest request = new UserRequest();
        request.setEmail(email);
        request.setPassword(RAW_PASSWORD);
        return request;
    }

    // 체크포인트 1: 정상 로그인은 계속 동작해야 한다 (회귀 확인)
    @Test
    void nonSuspendedUserLoginSucceeds() throws Exception {
        createUser("ok-login@test.com", "정상유저", "user");

        ResponseEntity<?> response = authService.login(loginRequest("ok-login@test.com"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body.get("accessToken"));
    }

    // 체크포인트 1: 정지 중인 회원은 403 ACCOUNT_SUSPENDED를 받고 토큰을 받지 못한다
    @Test
    void suspendedUserLoginReturns403WithCode() throws Exception {
        UserEntity user = createUser("suspend-login@test.com", "정지유저1", "user");
        suspensionService.suspend(user.getId(), 3, "테스트 정지");

        ResponseEntity<?> response = authService.login(loginRequest("suspend-login@test.com"));

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals("ACCOUNT_SUSPENDED", body.get("code"));
        assertNotNull(body.get("suspendedUntil"));
        assertNull(body.get("accessToken"));
    }

    // 체크포인트 2: 정지 중인 회원은 Refresh Token이 유효해도 401(REFRESH_FAILED_MESSAGE)로 처리된다
    @Test
    void suspendedUserRefreshTokenReturns401() throws Exception {
        UserEntity user = createUser("suspend-refresh@test.com", "정지유저2", "user");
        JwtConfig.TokenResponse tokens = jwtConfig.createTokenPair(user.getEmail());

        suspensionService.suspend(user.getId(), 3, "테스트 정지");

        ResponseEntity<?> response = authService.refreshToken(tokens.refreshToken());

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    // 체크포인트 2 회귀 확인: 정지되지 않은 회원은 그대로 재발급된다
    @Test
    void nonSuspendedUserRefreshTokenSucceeds() throws Exception {
        UserEntity user = createUser("ok-refresh@test.com", "정상유저2", "user");
        JwtConfig.TokenResponse tokens = jwtConfig.createTokenPair(user.getEmail());

        ResponseEntity<?> response = authService.refreshToken(tokens.refreshToken());

        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    // 체크포인트 3: 정지 적용 이전에 발급된 Access Token은 정지 적용 다음 요청부터 인증되지 않는다
    @Test
    void suspendedUserExistingAccessTokenRejectedByFilter() throws Exception {
        UserEntity user = createUser("suspend-filter@test.com", "정지유저3", "user");
        String accessToken = jwtConfig.createAccessToken(user.getEmail());
        FilterChain noopChain = (req, res) -> {};

        // 정지 전: 인증 정보가 정상적으로 채워져야 한다
        MockHttpServletRequest beforeRequest = new MockHttpServletRequest();
        beforeRequest.addHeader("Authorization", "Bearer " + accessToken);
        jwtAuthenticationFilter.doFilter(beforeRequest, new MockHttpServletResponse(), noopChain);
        Authentication beforeAuth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(beforeAuth);
        assertEquals(user.getEmail(), beforeAuth.getName());
        SecurityContextHolder.clearContext();

        suspensionService.suspend(user.getId(), 3, "테스트 정지");

        // 정지 후: 같은 토큰이어도 인증 정보가 채워지지 않아야 한다
        MockHttpServletRequest afterRequest = new MockHttpServletRequest();
        afterRequest.addHeader("Authorization", "Bearer " + accessToken);
        jwtAuthenticationFilter.doFilter(afterRequest, new MockHttpServletResponse(), noopChain);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    // 자동 해제: 배치 없이 만료 시각만 지나면 다음 로그인부터 정상 처리된다
    @Test
    void expiredSuspensionAllowsLoginAgain() throws Exception {
        UserEntity user = createUser("expired-suspend@test.com", "정지유저4", "user");
        suspensionService.suspend(user.getId(), 3, "테스트 정지");

        // 테스트 데이터 조작으로 만료 시각을 과거로 되돌린다 (설계 §9.2 시나리오 6)
        user.suspend(LocalDateTime.now().minusMinutes(1), "테스트 정지", LocalDateTime.now().minusDays(1));
        userRepository.save(user);

        ResponseEntity<?> response = authService.login(loginRequest("expired-suspend@test.com"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    // FR-U06: 관리자가 자기 자신을 정지 대상으로 지정하면 403
    @Test
    void adminCannotSuspendSelf() {
        UserEntity admin = createUser("self-admin@test.com", "관리자1", "ADMIN");

        assertThrows(AccessDeniedException.class, () ->
                userAdminService.suspend(admin.getId(), admin.getEmail(), 3, "자기 자신 테스트"));
    }

    // FR-U06: 등급 변경도 동일하게 막혀야 한다
    @Test
    void adminCannotChangeOwnGrade() {
        UserEntity admin = createUser("self-admin-grade@test.com", "관리자2", "ADMIN");

        assertThrows(AccessDeniedException.class, () ->
                userAdminService.updateGrade(admin.getId(), admin.getEmail(), "user"));
    }
}
