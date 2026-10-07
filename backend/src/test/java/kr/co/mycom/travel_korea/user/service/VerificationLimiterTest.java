package kr.co.mycom.travel_korea.user.service;

import kr.co.mycom.travel_korea.common.exception.TooManyRequestsException;
import org.junit.jupiter.api.Test;

import java.security.SecureRandom;

import static org.junit.jupiter.api.Assertions.*;

/* 발송 제한, 확인 실패 제한, 재발송 시 초기화, 인증번호 범위를 메일 발송 없이 확인합니다. */
class VerificationLimiterTest {

    private static final String KEY = "SIGNUP:limiter@example.com";

    @Test
    void secondSendWithinCooldownIsRejected() {
        VerificationLimiter limiter = new VerificationLimiter(180_000, 60_000);
        limiter.checkSendAllowed(KEY);
        limiter.recordSend(KEY);

        TooManyRequestsException e = assertThrows(TooManyRequestsException.class, () -> limiter.checkSendAllowed(KEY));
        assertTrue(e.getMessage().contains("잠시 후"), e.getMessage());
    }

    @Test
    void fifthSendInAnHourIsAllowedAndSixthIsRejected() {
        VerificationLimiter limiter = new VerificationLimiter(180_000, 0);
        for (int i = 0; i < VerificationLimiter.MAX_SENDS_PER_HOUR; i++) {
            limiter.checkSendAllowed(KEY);
            limiter.recordSend(KEY);
        }

        TooManyRequestsException e = assertThrows(TooManyRequestsException.class, () -> limiter.checkSendAllowed(KEY));
        assertTrue(e.getMessage().contains("발송 횟수"), e.getMessage());
    }

    @Test
    void fifthFailedAttemptBlocksTheCodeUntilResend() {
        VerificationLimiter limiter = new VerificationLimiter(180_000, 0);
        for (int i = 0; i < VerificationLimiter.MAX_FAILED_ATTEMPTS; i++) {
            limiter.recordFailure(KEY);
        }
        assertThrows(TooManyRequestsException.class, () -> limiter.checkAttemptAllowed(KEY));

        // 재발송은 새 인증번호이므로 실패 횟수가 초기화된다
        limiter.recordSend(KEY);
        assertDoesNotThrow(() -> limiter.checkAttemptAllowed(KEY));
    }

    @Test
    void successfulVerificationResetsFailuresButNotSendCount() {
        VerificationLimiter limiter = new VerificationLimiter(180_000, 0);
        for (int i = 0; i < VerificationLimiter.MAX_SENDS_PER_HOUR - 1; i++) {
            limiter.recordSend(KEY);
        }
        for (int i = 0; i < VerificationLimiter.MAX_FAILED_ATTEMPTS; i++) {
            limiter.recordFailure(KEY);
        }
        limiter.recordSuccess(KEY);
        assertDoesNotThrow(() -> limiter.checkAttemptAllowed(KEY));

        // 발송 횟수는 성공 후에도 유지되므로, 한 번 더 보내면 한도(5회)에 도달한다
        limiter.recordSend(KEY);
        assertThrows(TooManyRequestsException.class, () -> limiter.checkSendAllowed(KEY));
    }

    @Test
    void generatedCodesAreSixDigitsFromSecureRandom() {
        SecureRandom random = new SecureRandom();
        for (int i = 0; i < 10_000; i++) {
            int code = AuthService.newCode(random);
            assertTrue(code >= 100_000 && code <= 999_999, "범위를 벗어난 인증번호: " + code);
        }
    }
}
