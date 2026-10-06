package kr.co.mycom.travel_korea.tour.dto.external;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;

/*
 * TourAPI의 items 필드는 결과가 있으면 객체({"item": [...]}), 없으면 빈 문자열("")입니다.
 * 두 형태 모두 역직렬화되어야 하며, 빈 문자열은 item == null 로 받아 404 경로로 보내야 합니다.
 * 공통 상세(Common)와 유형별 상세(Intro) 두 응답이 같은 규칙을 씁니다.
 */
class TourApiRawItemsDeserializationTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void commonItemsObjectIsDeserialized() {
        TourApiDetailCommonRawResponse.Items items = mapper.readValue(
                "{\"item\":[{\"contentid\":\"126508\",\"title\":\"경복궁\"}]}",
                TourApiDetailCommonRawResponse.Items.class);

        assertNotNull(items.item());
        assertEquals(1, items.item().size());
    }

    @Test
    void commonItemsEmptyStringIsDeserializedAsEmptyItems() {
        TourApiDetailCommonRawResponse.Items items = mapper.readValue("\"\"", TourApiDetailCommonRawResponse.Items.class);

        assertNull(items.item());
    }

    @Test
    void introItemsObjectIsDeserialized() {
        TourApiDetailIntroRawResponse.Items items = mapper.readValue(
                "{\"item\":[{\"contentid\":\"126508\",\"contenttypeid\":\"12\"}]}",
                TourApiDetailIntroRawResponse.Items.class);

        assertNotNull(items.item());
        assertEquals(1, items.item().size());
    }

    @Test
    void introItemsEmptyStringIsDeserializedAsEmptyItems() {
        TourApiDetailIntroRawResponse.Items items = mapper.readValue("\"\"", TourApiDetailIntroRawResponse.Items.class);

        assertNull(items.item());
    }
}
