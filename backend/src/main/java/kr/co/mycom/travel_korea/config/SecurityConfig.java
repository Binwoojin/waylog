package kr.co.mycom.travel_korea.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;


@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

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
                * JWT 인증 Filter를 기본 로그인 Filter 이전에 실행합니다.
                */
               .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

            return http.build();
    }
}
