package kr.co.mycom.travel_korea.user;

import com.github.benmanes.caffeine.cache.Cache;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import kr.co.mycom.travel_korea.user.service.EmailVerificationPurpose;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.HashMap;
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
 * DB 유니크 제약(uk_users_email, uk_users_nickname)이 실제로 걸리는지, 동시 가입에서 중복이 한 번만 저장되는지 확인합니다.
 * 테스트 DB는 엔티티 기준으로 만들어지므로 @Table의 uniqueConstraints가 그대로 적용됩니다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "local-mock"})
class NicknameUniquenessHttpFlowTest {

    private static final String RAW_PASSWORD = "Passw0rd!1";

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private Cache<String, String> emailVerificationTicketCache;

    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void databaseRejectsDuplicateEmail() {
        String email = "db-unique-" + UUID.randomUUID() + "@example.com";
        userRepository.saveAndFlush(new UserEntity(email, passwordEncoder.encode(RAW_PASSWORD), uniqueNickname(), "user"));

        assertThrows(DataIntegrityViolationException.class, () ->
                userRepository.saveAndFlush(new UserEntity(email, passwordEncoder.encode(RAW_PASSWORD), uniqueNickname(), "user")));
    }

    @Test
    void concurrentSignupsWithSameNicknameStoreOnlyOneAccount() throws Exception {
        String nickname = uniqueNickname();
        int threads = 5;
        List<String> emails = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            String email = "race-" + i + "-" + UUID.randomUUID() + "@example.com";
            emails.add(email);
            // 이메일마다 자기 티켓이 있으므로, 닉네임 충돌만 경쟁한다
            emailVerificationTicketCache.put(EmailVerificationPurpose.SIGNUP.keyOf(email), UUID.randomUUID().toString());
        }

        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<HttpResponse<String>>> futures = new ArrayList<>();
        try {
            for (String email : emails) {
                futures.add(pool.submit((Callable<HttpResponse<String>>) () -> {
                    start.await();
                    return signup(email, nickname);
                }));
            }
            start.countDown();
            List<HttpResponse<String>> responses = new ArrayList<>();
            for (Future<HttpResponse<String>> future : futures) {
                responses.add(future.get());
            }

            List<String> bodies = responses.stream().map(HttpResponse::body).toList();
            long created = responses.stream().filter(r -> r.statusCode() == 200).count();
            long rejected = responses.stream().filter(r -> r.statusCode() == 400
                    && r.body().contains("이미 사용 중인 닉네임입니다.")).count();
            assertEquals(1, created, bodies.toString());
            assertEquals(threads - 1, rejected, bodies.toString());
            assertEquals(1, userRepository.findAll().stream().filter(u -> nickname.equals(u.getNickname())).count());
        } finally {
            pool.shutdownNow();
        }
    }

    private HttpResponse<String> signup(String email, String nickname) throws Exception {
        Map<String, Object> agreements = new HashMap<>();
        agreements.put("service", true);
        agreements.put("privacy", true);
        agreements.put("marketing", false);
        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        body.put("password", RAW_PASSWORD);
        body.put("nickname", nickname);
        body.put("verificationToken", emailVerificationTicketCache.getIfPresent(EmailVerificationPurpose.SIGNUP.keyOf(email)));
        body.put("agreements", agreements);
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/auth/signup"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private String uniqueNickname() {
        return "n" + UUID.randomUUID().toString().substring(0, 8);
    }
}
