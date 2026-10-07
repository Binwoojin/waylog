package kr.co.mycom.travel_korea.user;

import com.github.benmanes.caffeine.cache.Cache;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
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
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/*
 * 회원가입 약관 동의 서버 검증의 HTTP 회귀 테스트입니다.
 * 프론트 SignupPage가 보내는 agreements({service, privacy, marketing})를 기준으로 합니다.
 * 인증 티켓은 이메일 인증 흐름(메일 발송) 대신 티켓 캐시에 직접 넣어 준비합니다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "local-mock"})
class TermsAgreementHttpFlowTest {

    private static final String RAW_PASSWORD = "Passw0rd!1";

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private Cache<String, String> emailVerificationTicketCache;

    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void missingAgreementsIsRejectedAndAccountIsNotCreated() throws Exception {
        String email = prepareTicket();
        Map<String, Object> body = signupBody(email, null);
        body.remove("agreements");

        HttpResponse<String> response = signup(body);

        assertEquals(400, response.statusCode());
        assertTrue(response.body().contains("필수 약관에 동의해 주세요."), response.body());
        assertFalse(userRepository.findByEmail(email).isPresent());
    }

    @Test
    void nullAgreementsIsRejectedAndAccountIsNotCreated() throws Exception {
        String email = prepareTicket();
        Map<String, Object> body = signupBody(email, null);
        body.put("agreements", null);

        HttpResponse<String> response = signup(body);

        assertEquals(400, response.statusCode());
        assertTrue(response.body().contains("필수 약관에 동의해 주세요."), response.body());
        assertFalse(userRepository.findByEmail(email).isPresent());
    }

    @Test
    void serviceTermsMissingOrFalseIsRejected() throws Exception {
        String email = prepareTicket();

        Map<String, Object> missingService = signupBody(email, agreements(null, true, false));
        HttpResponse<String> missing = signup(missingService);
        assertEquals(400, missing.statusCode());
        assertTrue(missing.body().contains("필수 약관에 동의해 주세요."), missing.body());

        HttpResponse<String> falseService = signup(signupBody(email, agreements(false, true, false)));
        assertEquals(400, falseService.statusCode());
        assertTrue(falseService.body().contains("필수 약관에 동의해 주세요."), falseService.body());

        assertFalse(userRepository.findByEmail(email).isPresent());
    }

    @Test
    void privacyTermsMissingOrFalseIsRejected() throws Exception {
        String email = prepareTicket();

        Map<String, Object> missingPrivacy = signupBody(email, agreements(true, null, false));
        HttpResponse<String> missing = signup(missingPrivacy);
        assertEquals(400, missing.statusCode());
        assertTrue(missing.body().contains("필수 약관에 동의해 주세요."), missing.body());

        HttpResponse<String> falsePrivacy = signup(signupBody(email, agreements(true, false, false)));
        assertEquals(400, falsePrivacy.statusCode());
        assertTrue(falsePrivacy.body().contains("필수 약관에 동의해 주세요."), falsePrivacy.body());

        assertFalse(userRepository.findByEmail(email).isPresent());
    }

    @Test
    void requiredTermsAcceptedWithoutMarketingConsentSucceeds() throws Exception {
        String email = prepareTicket();

        HttpResponse<String> response = signup(signupBody(email, agreements(true, true, false)));

        assertEquals(200, response.statusCode(), response.body());
        assertTrue(userRepository.findByEmail(email).isPresent());
    }

    @Test
    void marketingConsentOmittedAlsoSucceeds() throws Exception {
        String email = prepareTicket();
        Map<String, Object> body = signupBody(email, agreements(true, true, null));

        HttpResponse<String> response = signup(body);

        assertEquals(200, response.statusCode(), response.body());
        assertTrue(userRepository.findByEmail(email).isPresent());
    }

    @Test
    void rejectedSignupCanBeRetriedWithSameTicketAfterFixingAgreements() throws Exception {
        String email = prepareTicket();
        String token = emailVerificationTicketCache.getIfPresent(EmailVerificationPurpose.SIGNUP.keyOf(email));
        assertNotNull(token);

        HttpResponse<String> rejected = signup(signupBody(email, agreements(true, false, false)));
        assertEquals(400, rejected.statusCode());
        assertFalse(userRepository.findByEmail(email).isPresent());
        // 거부 시점에 티켓이 소모되면 안 됩니다.
        assertEquals(token, emailVerificationTicketCache.getIfPresent(EmailVerificationPurpose.SIGNUP.keyOf(email)));

        HttpResponse<String> retried = signup(signupBody(email, agreements(true, true, false)));

        assertEquals(200, retried.statusCode(), retried.body());
        assertTrue(userRepository.findByEmail(email).isPresent());
        // 성공 후에는 티켓이 소모되어 재사용할 수 없습니다.
        assertNull(emailVerificationTicketCache.getIfPresent(EmailVerificationPurpose.SIGNUP.keyOf(email)));
    }

    // 이메일별 유효 인증 티켓을 캐시에 넣고 이메일을 돌려줍니다.
    private String prepareTicket() {
        String email = "terms-" + UUID.randomUUID() + "@example.com";
        emailVerificationTicketCache.put(EmailVerificationPurpose.SIGNUP.keyOf(email), UUID.randomUUID().toString());
        return email;
    }

    private Map<String, Object> signupBody(String email, Map<String, Object> agreements) {
        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        body.put("password", RAW_PASSWORD);
        body.put("nickname", "t" + UUID.randomUUID().toString().substring(0, 8));
        body.put("verificationToken", emailVerificationTicketCache.getIfPresent(EmailVerificationPurpose.SIGNUP.keyOf(email)));
        body.put("agreements", agreements);
        return body;
    }

    private Map<String, Object> agreements(Boolean service, Boolean privacy, Boolean marketing) {
        Map<String, Object> agreements = new HashMap<>();
        agreements.put("service", service);
        agreements.put("privacy", privacy);
        agreements.put("marketing", marketing);
        return agreements;
    }

    private HttpResponse<String> signup(Map<String, Object> body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/auth/signup"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
