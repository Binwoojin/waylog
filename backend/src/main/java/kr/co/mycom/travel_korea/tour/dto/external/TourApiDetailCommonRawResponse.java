package kr.co.mycom.travel_korea.tour.dto.external;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/** TourAPI detailCommon2의 원본 응답 구조입니다. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TourApiDetailCommonRawResponse(
        Response response
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Response(Header header, Body body) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Header(String resultCode, String resultMsg) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Body(Items items) {
    }

    /*
     * 결과가 없으면 TourAPI는 items를 객체가 아닌 ""(빈 문자열)로 내려줍니다.
     * 빈 Items(item == null)로 받아 TourClient에서 404(TOUR_CONTENT_NOT_FOUND)로 처리합니다.
     * 이 생성자가 없으면 역직렬화가 실패해 외부 장애(502)로 잘못 분류됩니다.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Items(List<TourApiDetailCommonItem> item) {

        @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
        static Items fromString(String ignored) {
            return new Items(null);
        }
    }
}
