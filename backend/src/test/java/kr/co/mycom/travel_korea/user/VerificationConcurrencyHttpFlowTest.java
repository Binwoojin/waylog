package kr.co.mycom.travel_korea.user;

import com.github.benmanes.caffeine.cache.Cache;
import kr.co.mycom.travel_korea.user.service.EmailVerificationPurpose;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.*;

/*
 * 실제 확인 엔드포인트에 동시에 요청해도 확인 시도 한도(5회)가 지켜지는지 확인합니다.
 * 인증번호는 메일로 보내지 않고 용도 키로 캐시에 직접 넣습니다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "local-mock"})
class VerificationConcurrencyHttpFlowTest {

    private static final int ISSUED_CODE = 246810;
    private static final int WRONG_CODE = 135790;

    @LocalServerPort
    private int port;

    @Autowired
    private Cache<String, Integer> emailVerificationCache;

    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void concurrentWrongConfirmsAreCappedAtTheAttemptLimit() throws Exception {
        String email = "vc-" + UUID.randomUUID() + "@example.com";
        emailVerificationCache.put(EmailVerificationPurpose.SIGNUP.keyOf(email), ISSUED_CODE);

        int threads = 20;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Integer>> futures = new ArrayList<>();
        try {
            for (int i = 0; i < threads; i++) {
                futures.add(pool.submit((Callable<Integer>) () -> {
                    start.await();
                    return confirm(email, WRONG_CODE, "SIGNUP").statusCode();
                }));
            }
            start.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> future : futures) {
                statuses.add(future.get());
            }

            long unauthorized = statuses.stream().filter(s -> s == 401).count();
            long limited = statuses.stream().filter(s -> s == 429).count();
            assertEquals(5, unauthorized, "틀린 확인은 한도(5회)까지만 비교되어야 함: " + statuses);
            assertEquals(threads - 5, limited, "나머지 요청은 429여야 함: " + statuses);
        } finally {
            pool.shutdownNow();
        }

        // 한도에 도달한 뒤에는 맞는 번호도 거부되어야 한다
        HttpResponse<String> right = confirm(email, ISSUED_CODE, "SIGNUP");
        assertEquals(429, right.statusCode(), right.body());
    }

    private HttpResponse<String> confirm(String email, int code, String purpose) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/auth/email-verification/confirm"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(
                        Map.of("email", email, "authCode", code, "purpose", purpose))))
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
