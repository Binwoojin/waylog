package kr.co.mycom.travel_korea.user;

import com.github.benmanes.caffeine.cache.Cache;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.service.EmailVerificationPurpose;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
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
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/*
 * 가입 시 서버의 중복 검사 회귀 테스트입니다.
 * 프론트 중복 확인은 우회될 수 있으므로, 같은 이메일이나 닉네임으로 직접 가입 요청해도 거부되어야 합니다.
 * 거부된 요청은 인증 티켓을 소모하지 않으므로 같은 티켓으로 다시 가입할 수 있어야 합니다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "local-mock"})
class DuplicateSignupHttpFlowTest {

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
    void duplicateEmailIsRejectedWithoutConsumingTicket() throws Exception {
        String existingEmail = "dup-existing-" + UUID.randomUUID() + "@example.com";
        userRepository.save(new UserEntity(existingEmail, passwordEncoder.encode(RAW_PASSWORD), uniqueNickname(), "user"));
        emailVerificationTicketCache.put(EmailVerificationPurpose.SIGNUP.keyOf(existingEmail), UUID.randomUUID().toString());

        HttpResponse<String> response = signup(signupBody(existingEmail, uniqueNickname()));

        assertEquals(400, response.statusCode(), response.body());
        assertTrue(response.body().contains("이미 사용 중인 이메일입니다."), response.body());
        assertEquals(1, userRepository.findAll().stream().filter(u -> existingEmail.equals(u.getEmail())).count());
        assertNotNull(emailVerificationTicketCache.getIfPresent(EmailVerificationPurpose.SIGNUP.keyOf(existingEmail)), "중복 거부는 인증 티켓을 소모하면 안 됩니다");
    }

    @Test
    void duplicateNicknameIsRejectedAndTicketCanBeReusedWithNewNickname() throws Exception {
        String takenNickname = uniqueNickname();
        userRepository.save(new UserEntity("dup-nick-" + UUID.randomUUID() + "@example.com", passwordEncoder.encode(RAW_PASSWORD), takenNickname, "user"));
        String newEmail = "dup-new-" + UUID.randomUUID() + "@example.com";
        emailVerificationTicketCache.put(EmailVerificationPurpose.SIGNUP.keyOf(newEmail), UUID.randomUUID().toString());

        HttpResponse<String> rejected = signup(signupBody(newEmail, takenNickname));

        assertEquals(400, rejected.statusCode(), rejected.body());
        assertTrue(rejected.body().contains("이미 사용 중인 닉네임입니다."), rejected.body());
        assertFalse(userRepository.findByEmail(newEmail).isPresent());
        assertNotNull(emailVerificationTicketCache.getIfPresent(EmailVerificationPurpose.SIGNUP.keyOf(newEmail)));

        HttpResponse<String> retried = signup(signupBody(newEmail, uniqueNickname()));

        assertEquals(200, retried.statusCode(), retried.body());
        assertTrue(userRepository.findByEmail(newEmail).isPresent());
    }

    private String uniqueNickname() {
        return "d" + UUID.randomUUID().toString().substring(0, 8);
    }

    // 인증 티켓을 캐시에 넣고, 약관에 모두 동의한 가입 요청 본문을 만든다.
    private Map<String, Object> signupBody(String email, String nickname) {
        String ticket = emailVerificationTicketCache.getIfPresent(EmailVerificationPurpose.SIGNUP.keyOf(email));
        if (ticket == null) {
            ticket = UUID.randomUUID().toString();
            emailVerificationTicketCache.put(EmailVerificationPurpose.SIGNUP.keyOf(email), ticket);
        }
        Map<String, Object> agreements = new HashMap<>();
        agreements.put("service", true);
        agreements.put("privacy", true);
        agreements.put("marketing", false);
        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        body.put("password", RAW_PASSWORD);
        body.put("nickname", nickname);
        body.put("verificationToken", ticket);
        body.put("agreements", agreements);
        return body;
    }

    private HttpResponse<String> signup(Map<String, Object> body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/auth/signup"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
