package kr.co.mycom.travel_korea;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@EnableCaching
@SpringBootApplication
public class TravelKoreaApplication {

    public static void main(String[] args) {
        SpringApplication.run(TravelKoreaApplication.class, args);
    }

}
