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
}
