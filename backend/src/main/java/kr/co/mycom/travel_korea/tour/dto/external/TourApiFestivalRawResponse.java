package kr.co.mycom.travel_korea.tour.dto.external;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/** searchFestival2의 원본 JSON 응답 구조입니다. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TourApiFestivalRawResponse(Response response) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Response(Header header, Body body) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Header(String resultCode, String resultMsg) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Body(Items items, int numOfRows, int pageNo, int totalCount) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Items(List<TourApiFestivalItem> item) {}
}
