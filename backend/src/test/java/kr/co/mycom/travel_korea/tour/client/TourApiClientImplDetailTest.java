package kr.co.mycom.travel_korea.tour.client;

import com.sun.net.httpserver.HttpServer;
import kr.co.mycom.travel_korea.tour.config.TourApiProperties;
import kr.co.mycom.travel_korea.tour.dto.external.TourApiDetailCommonItem;
import kr.co.mycom.travel_korea.tour.exception.TourApiException;
import kr.co.mycom.travel_korea.tour.exception.TourContentNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

/**
 * TourAPI 상세 조회(detailCommon2)의 "데이터 없음"과 "외부 장애"가 올바른 예외로 나뉘는지 검증한다.
 *
 * 실제 TourAPI는 결과가 없을 때 resultCode 0000과 함께 items를 객체가 아닌 빈 문자열("")로 내려준다.
 * 이 응답을 객체로 역직렬화하다 실패하면 404가 아니라 502(TOUR_API_COMMUNICATION_ERROR)가 되므로,
 * 실제 응답 본문을 흉내 낸 로컬 서버로 클라이언트 전체 경로를 고정한다.
 */
class TourApiClientImplDetailTest {

    private static final String NO_DATA_BODY = """
            {"response": {"header":{"resultCode":"0000","resultMsg":"OK"},"body": {"items": "","numOfRows":0,"pageNo":1,"totalCount":0}}}
            """;

    private static final String FOUND_BODY = """
            {"response": {"header":{"resultCode":"0000","resultMsg":"OK"},"body": {"items": {"item":[{"contentid":"126508","contenttypeid":"12","title":"경복궁","addr1":"서울특별시 종로구","overview":"조선의 법궁"}]},"numOfRows":1,"pageNo":1,"totalCount":1}}}
            """;

    private HttpServer server;
    private TourApiClientImpl client;
    private volatile int status;
    private volatile String body;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/KorService2/detailCommon2", exchange -> {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json;charset=UTF-8");
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        });
        server.start();

        String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/KorService2";
        TourApiProperties properties = new TourApiProperties(
                new URL(baseUrl),
                "test-key",
                "ETC",
                "WayLog-Test",
                Duration.ofSeconds(3),
                Duration.ofSeconds(3)
        );
        client = new TourApiClientImpl(RestClient.builder().baseUrl(baseUrl).build(), properties);
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void emptyItemsStringIsTreatedAsContentNotFound() {
        status = 200;
        body = NO_DATA_BODY;

        assertThrows(
                TourContentNotFoundException.class,
                () -> client.getDetailCommon("999999999", 12)
        );
    }

    @Test
    void itemsObjectIsReturnedAsDetailCommon() {
        status = 200;
        body = FOUND_BODY;

        TourApiDetailCommonItem item = client.getDetailCommon("126508", 12);

        assertEquals("126508", item.contentid());
        assertEquals("경복궁", item.title());
    }

    @Test
    void serverErrorStaysCommunicationError() {
        status = 500;
        body = "{}";

        TourApiException exception = assertThrows(
                TourApiException.class,
                () -> client.getDetailCommon("126508", 12)
        );
        assertEquals("TOUR_API_COMMUNICATION_ERROR", exception.getErrorCode());
    }
}
