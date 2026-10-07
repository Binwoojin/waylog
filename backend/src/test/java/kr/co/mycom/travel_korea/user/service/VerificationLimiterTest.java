package kr.co.mycom.travel_korea.user.service;

import kr.co.mycom.travel_korea.common.exception.TooManyRequestsException;
import org.junit.jupiter.api.Test;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/* 발송 제한, 확인 시도 제한, 재발송·성공 시 초기화, 인증번호 범위, 동시 요청에서의 제한을 확인합니다. */
class VerificationLimiterTest {

    private static final String KEY = "SIGNUP:limiter@example.com";

    @Test
    void secondSendWithinCooldownIsRejected() {
        VerificationLimiter limiter = new VerificationLimiter(180_000, 60_000);
        limiter.reserveSend(KEY);

        TooManyRequestsException e = assertThrows(TooManyRequestsException.class, () -> limiter.reserveSend(KEY));
        assertTrue(e.getMessage().contains("잠시 후"), e.getMessage());
    }

    @Test
    void fifthSendInAnHourIsAllowedAndSixthIsRejected() {
        VerificationLimiter limiter = new VerificationLimiter(180_000, 0);
        for (int i = 0; i < VerificationLimiter.MAX_SENDS_PER_HOUR; i++) {
            limiter.reserveSend(KEY);
        }

        TooManyRequestsException e = assertThrows(TooManyRequestsException.class, () -> limiter.reserveSend(KEY));
        assertTrue(e.getMessage().contains("발송 횟수"), e.getMessage());
    }

    @Test
    void failedMailSendReleasesTheReservation() {
        VerificationLimiter limiter = new VerificationLimiter(180_000, 60_000);
        limiter.reserveSend(KEY);
        limiter.releaseSend(KEY);

        // 발송이 실패했으므로 간격과 횟수를 소모하지 않아 바로 다시 요청할 수 있어야 한다
        assertDoesNotThrow(() -> limiter.reserveSend(KEY));
    }

    @Test
    void failedSendDoesNotResetAttemptsOfTheStillValidCode() {
        VerificationLimiter limiter = new VerificationLimiter(180_000, 0);
        for (int i = 0; i < VerificationLimiter.MAX_FAILED_ATTEMPTS; i++) {
            limiter.reserveAttempt(KEY);
        }
        // 재발송이 메일 오류로 실패하면 이전 인증번호는 그대로 유효하고, 시도 횟수도 그대로여야 한다
        limiter.reserveSend(KEY);
        limiter.releaseSend(KEY);

        assertThrows(TooManyRequestsException.class, () -> limiter.reserveAttempt(KEY));
    }

    @Test
    void sixthAttemptIsBlockedEvenWithTheRightCode() {
        VerificationLimiter limiter = new VerificationLimiter(180_000, 0);
        for (int i = 0; i < VerificationLimiter.MAX_FAILED_ATTEMPTS; i++) {
            limiter.reserveAttempt(KEY);
        }

        assertThrows(TooManyRequestsException.class, () -> limiter.reserveAttempt(KEY));
    }

    @Test
    void resendResetsAttemptsButSuccessfulVerificationKeepsSendCount() {
        VerificationLimiter limiter = new VerificationLimiter(180_000, 0);
        for (int i = 0; i < VerificationLimiter.MAX_SENDS_PER_HOUR - 1; i++) {
            limiter.reserveSend(KEY);
        }
        for (int i = 0; i < VerificationLimiter.MAX_FAILED_ATTEMPTS; i++) {
            limiter.reserveAttempt(KEY);
        }
        // 새 인증번호가 저장된 뒤에만 시도 횟수를 초기화한다
        limiter.reserveSend(KEY);
        limiter.recordSent(KEY);
        assertDoesNotThrow(() -> limiter.reserveAttempt(KEY));

        // 성공 후에도 발송 횟수는 유지되므로 한도(5회)에 도달해 있다
        limiter.recordSuccess(KEY);
        assertThrows(TooManyRequestsException.class, () -> limiter.reserveSend(KEY));
    }

    @Test
    void concurrentSendsNeverExceedTheHourlyLimit() throws Exception {
        VerificationLimiter limiter = new VerificationLimiter(180_000, 0);
        AtomicInteger allowed = runConcurrently(20, () -> limiter.reserveSend(KEY));
        assertEquals(VerificationLimiter.MAX_SENDS_PER_HOUR, allowed.get(), "동시 발송이 시간당 한도를 넘었음");
    }

    @Test
    void concurrentAttemptsNeverExceedTheAttemptLimit() throws Exception {
        VerificationLimiter limiter = new VerificationLimiter(180_000, 0);
        AtomicInteger allowed = runConcurrently(20, () -> limiter.reserveAttempt(KEY));
        assertEquals(VerificationLimiter.MAX_FAILED_ATTEMPTS, allowed.get(), "동시 확인 시도가 한도를 넘었음");
    }

    /* 여러 스레드가 같은 작업을 동시에 시작하고, 예외 없이 끝난 횟수를 돌려준다. */
    private static AtomicInteger runConcurrently(int threads, Runnable task) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger allowed = new AtomicInteger();
        List<Future<?>> futures = new ArrayList<>();
        try {
            for (int i = 0; i < threads; i++) {
                futures.add(pool.submit((Callable<Void>) () -> {
                    start.await();
                    try {
                        task.run();
                        allowed.incrementAndGet();
                    } catch (TooManyRequestsException ignored) {
                        // 제한에 걸린 요청
                    }
                    return null;
                }));
            }
            start.countDown();
            for (Future<?> future : futures) {
                future.get();
            }
        } finally {
            pool.shutdownNow();
        }
        return allowed;
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
