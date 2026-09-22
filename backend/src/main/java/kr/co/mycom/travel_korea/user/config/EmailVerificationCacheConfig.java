package kr.co.mycom.travel_korea.user.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class EmailVerificationCacheConfig {

    @Bean
    public Cache<String, Integer> emailVerificationCache(
            @Value("${spring.mail.auth-code-expiration-millis}") long authCodeExpirationMillis) {
        return Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofMillis(authCodeExpirationMillis))
                .maximumSize(10_000)
                .build();
    }

    /**
     * 이메일 인증 성공 시 발급하는 일회용 티켓을 저장합니다.
     *
     * 인증번호 확인만으로 끝나면 signup/changePassword가 인증 여부와
     * 무관하게 직접 호출될 수 있으므로, 인증 성공 시 이 캐시에 티켓을
     * 발급하고 signup/changePassword에서 소모(1회 사용 후 무효화)하도록
     * 강제합니다.
     */
    @Bean
    public Cache<String, String> emailVerificationTicketCache() {
        return Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofMinutes(10))
                .maximumSize(10_000)
                .build();
    }
}
