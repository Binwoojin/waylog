package kr.co.mycom.travel_korea.config;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.Map;


@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ObjectMapper objectMapper;

    private static final String UNAUTHORIZED_MESSAGE = "로그인이 필요합니다.";
    private static final String FORBIDDEN_MESSAGE = "접근 권한이 없습니다.";

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
       http
               .csrf(csrf -> csrf.disable())

                /*
                 * JWT 방식이므로 서버 세션을 생성하지 않습니다.
                 */
               .sessionManagement(session ->
                       session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
               )
               .authorizeHttpRequests(auth -> auth
                                // 로그인, 회원가입, 비밀번호 찾기는 비로그인 접근 허용
                               .requestMatchers("/api/v1/auth/**").permitAll()
                       // 회원가입 단계의 이메일·닉네임 중복확인은 비로그인 접근 허용
                       .requestMatchers(HttpMethod.GET, "/api/v1/users/check-email", "/api/v1/users/check-nickname").permitAll()
                       .requestMatchers("/error").permitAll()
                                // 공지 목록과 상세 조회는 모든 사용자에게 공개
                       .requestMatchers("/api/v1/notices", "/api/v1/notices/**").permitAll()

                       // 기존 공개 여행 정보 조회
                       .requestMatchers("/api/v1/home", "/api/v1/search", "/api/v1/regions/**", "/api/v1/classifications", "/api/v1/festivals/**").permitAll()

                       // 공개 피드 조회
                       .requestMatchers(HttpMethod.GET, "/api/v1/feed/posts/**").permitAll()
                       .requestMatchers(HttpMethod.GET, "/api/v1/tour/contents/**").permitAll()
                       /*
                        * 공지 등록·수정·삭제는 관리자만 허용합니다.
                        *
                        * DB GRADE가 ADMIN이면 ROLE_ADMIN을 사용합니다.
                        */
                       .requestMatchers("/api/v1/admin/**")
                       .hasAuthority("ROLE_ADMIN")

                       // 나머지 API는 로그인 사용자만 접근
                       .anyRequest().authenticated()
               )
               /*
                * 인증·인가 실패 응답을 프론트가 구분할 수 있도록 고정합니다.
                *
                * 기본 설정에서는 미인증 요청도 403으로 내려가서
                * 프론트가 "토큰 재발급 후 재시도"와 "권한 부족"을 구분할 수 없었습니다.
                */
               // Design Ref: §4.2 — 401은 재인증으로 해결 가능, 403은 권한 부족으로 의미를 고정
               .exceptionHandling(exception -> exception
                       .authenticationEntryPoint(authenticationEntryPoint())
                       .accessDeniedHandler(accessDeniedHandler())
               )
               /*
                * JWT 인증 Filter를 기본 로그인 Filter 이전에 실행합니다.
                */
               .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

            return http.build();
    }

    /*
     * 토큰이 없거나 만료·위조되어 인증되지 않은 요청입니다.
     *
     * JwtAuthenticationFilter는 잘못된 토큰이면 SecurityContext를 비우고 통과시키므로
     * permitAll API는 영향이 없고, 보호 API에서만 이 응답이 내려갑니다.
     * 비로그인 사용자가 /admin/** 에 접근한 경우도 여기서 401로 처리됩니다.
     */
    private AuthenticationEntryPoint authenticationEntryPoint() {
        return (request, response, authException) ->
                writeErrorResponse(response, HttpStatus.UNAUTHORIZED, UNAUTHORIZED_MESSAGE);
    }

    /*
     * 로그인은 했지만 권한이 부족한 요청입니다. (예: 일반 회원의 /admin/**)
     *
     * 프론트는 403을 받으면 토큰 재발급을 시도하지 않습니다.
     */
    private AccessDeniedHandler accessDeniedHandler() {
        return (request, response, accessDeniedException) ->
                writeErrorResponse(response, HttpStatus.FORBIDDEN, FORBIDDEN_MESSAGE);
    }

    // Design Ref: §6.2 — GlobalExceptionHandler와 같은 { "message": ... } 형식으로 통일
    private void writeErrorResponse(HttpServletResponse response,
                                    HttpStatus status,
                                    String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8");
        objectMapper.writeValue(response.getWriter(), Map.of("message", message));
    }
}
