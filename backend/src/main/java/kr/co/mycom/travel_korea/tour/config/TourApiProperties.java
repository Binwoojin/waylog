package kr.co.mycom.travel_korea.tour.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URL;
import java.time.Duration;

@ConfigurationProperties(prefix = "tour-api")
public record TourApiProperties(
        URL baseUrl,
        String serviceKey,
        String mobileOs,
        String mobileApp,
        Duration connectTimeout,
        Duration readTimeout
) {
}
