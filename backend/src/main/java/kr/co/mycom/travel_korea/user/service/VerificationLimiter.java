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
 * - 확인 시도: 인증번호 하나당 확인 요청은 최대 5회까지다. 맞춤 여부와 무관하게 횟수에 포함된다.
 *   재발송하면 새 인증번호가 생기므로 실패 횟수도 0으로 초기화한다.
 * - 인증 성공: 실패 횟수를 초기화한다.
 *
 * 검사와 기록은 같은 임계 구역에서 원자적으로 처리한다(synchronized). 이 제한 카운터는 메모리에만 있으므로
 * 재시작하면 초기화되고, 여러 인스턴스 사이에서는 공유되지 않는다. 문서 auth-verification-policy.md 8장 참고.
 */
@Component
public class VerificationLimiter {

    static final int MAX_FAILED_ATTEMPTS = 5;
    static final int MAX_SENDS_PER_HOUR = 5;

    // 확인 시도 횟수: 인증번호 하나당 확인 요청(맞춤 여부와 무관)을 최대 MAX_FAILED_ATTEMPTS번까지 허용한다.
    private final Cache<String, Integer> attempts;
    private final Cache<String, Integer> sendCounts;
    // cooldown이 0이면 발송 간격 제한을 두지 않는다(테스트에서 사용).
    private final Cache<String, Long> cooldowns;

    public VerificationLimiter(
            @Value("${spring.mail.auth-code-expiration-millis}") long codeTtlMillis,
            @Value("${auth.send-cooldown-millis:60000}") long cooldownMillis) {
        this.attempts = Caffeine.newBuilder().expireAfterWrite(Duration.ofMillis(codeTtlMillis)).maximumSize(10_000).build();
        this.sendCounts = Caffeine.newBuilder().expireAfterWrite(Duration.ofHours(1)).maximumSize(10_000).build();
        this.cooldowns = cooldownMillis > 0
                ? Caffeine.newBuilder().expireAfterWrite(Duration.ofMillis(cooldownMillis)).maximumSize(10_000).build()
                : null;
    }

    /*
     * 발송 예약: 간격·횟수를 검사하고 통과하면 같은 임계 구역 안에서 바로 기록한다.
     * 검사와 기록을 나누면 동시 요청이 모두 검사를 통과해 제한을 넘을 수 있으므로 한 번에 처리한다.
     * 메일 발송이 실패하면 releaseSend로 되돌린다.
     */
    public synchronized void reserveSend(String key) {
        if (cooldowns != null && cooldowns.getIfPresent(key) != null) {
            throw new TooManyRequestsException("잠시 후 다시 인증번호를 요청해 주세요.");
        }
        if (count(sendCounts, key) >= MAX_SENDS_PER_HOUR) {
            throw new TooManyRequestsException("인증번호 발송 횟수를 초과했습니다. 1시간 뒤에 다시 시도해 주세요.");
        }
        sendCounts.put(key, count(sendCounts, key) + 1);
        if (cooldowns != null) {
            cooldowns.put(key, System.currentTimeMillis());
        }
        // 재발송은 새 인증번호이므로 이전 번호의 확인 시도 횟수를 이어받지 않는다.
        attempts.invalidate(key);
    }

    /* 메일 발송이 실패했을 때 예약을 되돌린다. 실패한 발송이 횟수와 간격을 소모하지 않도록 한다. */
    public synchronized void releaseSend(String key) {
        int current = count(sendCounts, key);
        if (current > 0) {
            sendCounts.put(key, current - 1);
        }
        if (cooldowns != null) {
            cooldowns.invalidate(key);
        }
    }

    /*
     * 확인 시도 예약: 비교하기 전에 횟수를 먼저 올린다. 동시에 들어온 요청도 모두 횟수에 반영되므로
     * 인증번호 하나에 대해 MAX_FAILED_ATTEMPTS번을 넘는 비교는 일어나지 않는다.
     */
    public synchronized void reserveAttempt(String key) {
        int current = count(attempts, key);
        if (current >= MAX_FAILED_ATTEMPTS) {
            throw new TooManyRequestsException("인증 시도 횟수를 초과했습니다. 인증번호를 다시 받아 주세요.");
        }
        attempts.put(key, current + 1);
    }

    /* 인증에 성공하면 인증번호가 소모되므로 시도 횟수를 비운다. 발송 횟수는 유지한다. */
    public synchronized void recordSuccess(String key) {
        attempts.invalidate(key);
    }

    private static int count(Cache<String, Integer> cache, String key) {
        Integer value = cache.getIfPresent(key);
        return value == null ? 0 : value;
    }
}
