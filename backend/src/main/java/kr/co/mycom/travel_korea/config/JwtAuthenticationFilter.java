package kr.co.mycom.travel_korea.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Locale;

/**
 * Authorization 헤더의 Bearer JWT를 검증하고
 * Spring Security 로그인 정보로 등록하는 필터입니다.
 */

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtConfig jwtConfig;
    private final UserRepository userRepository;


    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);

        /*
         * Authorization 헤더가 없거나 Bearer 토큰 형식이 아니면
         * 인증 처리 없이 다음 필터로 넘깁니다.
         *
         * 공지사항 같은 permitAll 공개 API는 정상 접근할 수 있습니다.
         */

        if (authorization == null || !authorization.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String token = authorization.substring("Bearer ".length()).trim();

            // 현재 JwtConfig와 동일하게 토큰에서 이메일을 추출한다.
            String email = jwtConfig.validateAccessToken(token);

            UserEntity user = userRepository.findByEmail(email)
                    .orElseThrow(() ->
                        new IllegalArgumentException("회원 정보를 찾을 수 없습니다.")
                    );

            /*
             * GRADE 컬럼 값과 권한 문자열을 맞춰야 합니다.
             *
             * 예: DB의 grade 값이 ADMIN이면 ROLE_ADMIN으로 변환합니다.
             */
            String role = "ROLE_" + user.getGrade()
                    .trim().toUpperCase(Locale.ROOT);

            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of(new SimpleGrantedAuthority(role)));

            authentication.setDetails(
                    new WebAuthenticationDetailsSource()
                            .buildDetails(request)
            );

            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (Exception exception) {
            /*
             * 잘못된 토큰은 인증 정보를 비운 상태로 넘깁니다.
             * 이후 관리자 URL 접근은 401/403으로 차단됩니다.
             */
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);

    }
}
