package kr.co.mycom.travel_korea.tour.dto.external;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/** ldongCode2의 중첩 JSON 구조를 역직렬화합니다. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TourApiRegionRawResponse(Response response) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Response(Header header, Body body) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Header(String resultCode, String resultMsg) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Body(Items items) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Items(List<TourApiRegionItem> item) {}
}
