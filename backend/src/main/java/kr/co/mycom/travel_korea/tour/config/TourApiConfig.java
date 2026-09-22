package kr.co.mycom.travel_korea.tour.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * TourAPI 통신에 필요한 공통 설정 클래스
 *
 * 주요 역할
 * 1. application.yaml의 tour-api 설정을 TourApiProperties에 연결합니다.
 * 2. TourAPI 호출 전용 RestClient 객체를 생성합니다.
 * 3. 연결 시간과 응답 대기 시간을 제한합니다.
 */

@Configuration
@EnableConfigurationProperties(TourApiProperties.class)
public class TourApiConfig {
    /**
     * 한국관광공사 TourAPI를 호출할 때 사용할 RestClient를 등록합니다.
     *
     * RestClient를 Bean으로 등록하면 실제 Client 클래스에서
     * 매번 HTTP 클라이언트를 새로 만들지 않고 주입받아 사용할 수 있습니다.
     *
     * @param properties application.yaml의 tour-api 설정값
     * @return TourAPI 전용 RestClient
     */
    @Bean
    public RestClient tourApiRestClient(TourApiProperties properties) {
        /*
         * HTTP 연결 및 응답 시간 제한을 설정하는 객체입니다.
         *
         * connectTimeout:
         * TourAPI 서버와 연결이 성립될 때까지 기다리는 최대 시간
         *
         * readTimeout:
         * 연결 후 TourAPI 응답을 받을 때까지 기다리는 최대 시간
         */

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(properties.connectTimeout());
        requestFactory.setReadTimeout(properties.readTimeout());

        /*
         * baseUrl을 등록해 두면 실제 요청 코드에서는
         * 전체 주소가 아닌 "/areaBasedList2"만 작성하면 됩니다.
         */

        return RestClient.builder()
                .baseUrl(properties.baseUrl().toExternalForm())
                .requestFactory(requestFactory)
                .build();
    }
}

/**
 * TourAPI 주소, 서비스키, 앱 이름, 타임아웃 같은 외부 연동 설정을 Java 코드에
 * 직접 작성하지 않고 application.yaml과 환경변수로 분리했습니다.
 * 그리고 이 설정을 TourApiProperties에 바인딩하고,
 * TourApiConfig에서 TourAPI 전용 HTTP Client를 생성했습니다.
 */