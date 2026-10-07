package kr.co.mycom.travel_korea.user;

import com.github.benmanes.caffeine.cache.Cache;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import kr.co.mycom.travel_korea.user.service.EmailVerificationPurpose;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/* 인증번호와 티켓의 만료를 짧은 TTL로 확인합니다. */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.mail.auth-code-expiration-millis=400",
                "auth.ticket-expiration-millis=400"
        })
@ActiveProfiles({"test", "local-mock"})
class VerificationExpiryHttpFlowTest {

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private Cache<String, Integer> emailVerificationCache;

    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void expiredCodeCannotBeConfirmed() throws Exception {
        String email = "expire-code-" + UUID.randomUUID() + "@example.com";
        emailVerificationCache.put(EmailVerificationPurpose.SIGNUP.keyOf(email), 424242);

        Thread.sleep(900);

        HttpResponse<String> response = send("POST", "/api/v1/auth/email-verification/confirm",
                Map.of("email", email, "authCode", 424242, "purpose", "SIGNUP"));
        assertEquals(401, response.statusCode(), response.body());
    }

    @Test
    void expiredTicketCannotChangePassword() throws Exception {
        String email = "expire-ticket-" + UUID.randomUUID() + "@example.com";
        userRepository.save(new UserEntity(email, passwordEncoder.encode("Passw0rd!1"),
                "e" + UUID.randomUUID().toString().substring(0, 8), "user"));
        emailVerificationCache.put(EmailVerificationPurpose.RESET_PASSWORD.keyOf(email), 515151);
        HttpResponse<String> confirm = send("POST", "/api/v1/auth/email-verification/confirm",
                Map.of("email", email, "authCode", 515151, "purpose", "RESET_PASSWORD"));
        assertEquals(200, confirm.statusCode(), confirm.body());
        String ticket = mapper.readTree(confirm.body()).get("verificationToken").asString();

        Thread.sleep(900);

        HttpResponse<String> changed = send("PUT", "/api/v1/auth/password", Map.of(
                "email", email, "password", "NewPassw0rd!2", "verificationToken", ticket));
        assertEquals(400, changed.statusCode(), changed.body());
        assertTrue(changed.body().contains("이메일 인증이 필요합니다."), changed.body());
    }

    private HttpResponse<String> send(String method, String path, Map<String, ?> body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .method(method, HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
