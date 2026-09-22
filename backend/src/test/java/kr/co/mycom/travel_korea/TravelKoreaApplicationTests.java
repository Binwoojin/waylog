package kr.co.mycom.travel_korea;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class TravelKoreaApplicationTests {

    @Test
    void contextLoads() {
    }

}
