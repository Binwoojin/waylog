package kr.co.mycom.travel_korea.user;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

/*
 * 메일 발송이 실패하면 발송 예약이 되돌아가서, 같은 이메일로 바로 다시 요청할 수 있어야 한다.
 * 첫 발송만 실패하도록 메일 전송을 가짜로 만든다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "local-mock"})
class VerificationMailFailureHttpFlowTest {

    @LocalServerPort
    private int port;

    @MockitoBean
    private JavaMailSender mailSender;

    private final ObjectMapper mapper = new ObjectMapper();

    private final HttpClient client = HttpClient.newHttpClient();

    @Test
    void failedMailSendReleasesCooldownAndDoesNotCountAsSent() throws Exception {
        Session session = Session.getInstance(new Properties());
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage(session));
        doThrow(new MailSendException("smtp unavailable")).doNothing().when(mailSender).send(any(MimeMessage.class));

        String email = "mailfail-" + UUID.randomUUID() + "@example.com";

        HttpResponse<String> failed = send(email);
        assertEquals(500, failed.statusCode(), "메일 발송 실패는 500이어야 함");

        // 실패한 발송은 간격을 소모하지 않으므로 바로 다시 요청할 수 있어야 한다
        HttpResponse<String> retried = send(email);
        assertEquals(200, retried.statusCode(), retried.body());

        // 성공한 발송 뒤에는 정상적으로 간격 제한이 걸린다
        HttpResponse<String> tooSoon = send(email);
        assertEquals(429, tooSoon.statusCode(), tooSoon.body());
    }

    private HttpResponse<String> send(String email) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/auth/email-verification"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(Map.of("email", email))))
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
