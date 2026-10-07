package kr.co.mycom.travel_korea.user.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import kr.co.mycom.travel_korea.common.exception.TooManyRequestsException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * 인증번호 발송과 확인 시도를 제한합니다. 키는 EmailVerificationPurpose.keyOf(email)입니다.
 *
 * 제한값과 초기화 정책 (docs/development/auth-verification-policy.md와 같아야 함)
 * - 발송 재요청 간격: 같은 키에 대해 cooldown(기본 60초)보다 빨리 다시 발송할 수 없다.
 * - 발송 횟수: 같은 키에 대해 1시간 안에 최대 5회. 1시간은 마지막 발송 후 기준이다.
 *   발송 횟수는 인증에 성공해도 초기화하지 않는다. 성공 후 다시 발급받는 것을 막기 위해서다.
 * - 확인 실패: 인증번호 하나당 최대 5회 틀리면 그 인증번호는 더 이상 확인할 수 없다.
 *   재발송하면 새 인증번호가 생기므로 실패 횟수도 0으로 초기화한다.
 * - 인증 성공: 실패 횟수를 초기화한다.
 *
 * 발송 간격 검사와 기록 사이에는 짧은 경쟁 구간이 있다. 같은 이메일로 동시에 여러 번 요청하면
 * 제한을 한두 번 넘을 수 있으며, 이 한계는 문서에 명시한다.
 */
@Component
public class VerificationLimiter {

    static final int MAX_FAILED_ATTEMPTS = 5;
    static final int MAX_SENDS_PER_HOUR = 5;

    private final Cache<String, Integer> failedAttempts;
    private final Cache<String, Integer> sendCounts;
    // cooldown이 0이면 발송 간격 제한을 두지 않는다(테스트에서 사용).
    private final Cache<String, Long> cooldowns;

    public VerificationLimiter(
            @Value("${spring.mail.auth-code-expiration-millis}") long codeTtlMillis,
            @Value("${auth.send-cooldown-millis:60000}") long cooldownMillis) {
        this.failedAttempts = Caffeine.newBuilder().expireAfterWrite(Duration.ofMillis(codeTtlMillis)).maximumSize(10_000).build();
        this.sendCounts = Caffeine.newBuilder().expireAfterWrite(Duration.ofHours(1)).maximumSize(10_000).build();
        this.cooldowns = cooldownMillis > 0
                ? Caffeine.newBuilder().expireAfterWrite(Duration.ofMillis(cooldownMillis)).maximumSize(10_000).build()
                : null;
    }

    public void checkSendAllowed(String key) {
        if (cooldowns != null && cooldowns.getIfPresent(key) != null) {
            throw new TooManyRequestsException("잠시 후 다시 인증번호를 요청해 주세요.");
        }
        if (count(sendCounts, key) >= MAX_SENDS_PER_HOUR) {
            throw new TooManyRequestsException("인증번호 발송 횟수를 초과했습니다. 1시간 뒤에 다시 시도해 주세요.");
        }
    }

    public void recordSend(String key) {
        sendCounts.asMap().merge(key, 1, Integer::sum);
        if (cooldowns != null) {
            cooldowns.put(key, System.currentTimeMillis());
        }
        // 재발송은 새 인증번호이므로 이전 번호의 실패 횟수를 이어받지 않는다.
        failedAttempts.invalidate(key);
    }

    public void checkAttemptAllowed(String key) {
        if (count(failedAttempts, key) >= MAX_FAILED_ATTEMPTS) {
            throw new TooManyRequestsException("인증 시도 횟수를 초과했습니다. 인증번호를 다시 받아 주세요.");
        }
    }

    public void recordFailure(String key) {
        failedAttempts.asMap().merge(key, 1, Integer::sum);
    }

    public void recordSuccess(String key) {
        failedAttempts.invalidate(key);
    }

    private static int count(Cache<String, Integer> cache, String key) {
        Integer value = cache.getIfPresent(key);
        return value == null ? 0 : value;
    }
}
