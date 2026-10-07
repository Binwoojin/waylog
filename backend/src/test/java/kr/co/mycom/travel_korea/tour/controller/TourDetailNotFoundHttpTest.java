package kr.co.mycom.travel_korea.tour.controller;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 존재하지 않는 관광 콘텐츠 조회가 502가 아니라 404(TOUR_CONTENT_NOT_FOUND)로 응답하는지
 * 실제 HTTP 요청으로 검증한다.
 *
 * TourAPI는 결과가 없으면 resultCode 0000과 items="" 를 내려준다. 이 응답을 가짜 TourAPI 서버(JDK HttpServer)로
 * 흉내 내고, 실제 TourApiClientImpl이 tour-api.base-url을 통해 이 서버를 호출하도록 구성한다.
 * 외부 네트워크나 실제 TourAPI 키에 의존하지 않는다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class TourDetailNotFoundHttpTest {

    private static final String NO_DATA_BODY = """
            {"response": {"header":{"resultCode":"0000","resultMsg":"OK"},"body": {"items": "","numOfRows":0,"pageNo":1,"totalCount":0}}}
            """;

    private static final HttpServer FAKE_TOUR_API = startFakeTourApi();

    @LocalServerPort
    private int port;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    private static HttpServer startFakeTourApi() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/KorService2/detailCommon2", exchange -> {
                byte[] bytes = NO_DATA_BODY.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json;charset=UTF-8");
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream out = exchange.getResponseBody()) {
                    out.write(bytes);
                }
            });
            server.start();
            return server;
        } catch (IOException exception) {
            throw new IllegalStateException("가짜 TourAPI 서버를 시작하지 못했습니다.", exception);
        }
    }

    @DynamicPropertySource
    static void tourApiBaseUrl(DynamicPropertyRegistry registry) {
        registry.add("tour-api.base-url",
                () -> "http://127.0.0.1:" + FAKE_TOUR_API.getAddress().getPort() + "/KorService2");
    }

    @AfterAll
    static void stopFakeTourApi() {
        FAKE_TOUR_API.stop(0);
    }

    @Test
    void missingContentReturns404WithTourContentNotFoundCode() throws Exception {
        HttpResponse<String> response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:" + port + "/api/v1/tour/contents/999999999?contentTypeId=12"))
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );

        assertEquals(404, response.statusCode());
        assertTrue(response.body().contains("\"code\":\"TOUR_CONTENT_NOT_FOUND\""), response.body());
    }
}
