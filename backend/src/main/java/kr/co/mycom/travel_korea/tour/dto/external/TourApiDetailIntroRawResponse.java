package kr.co.mycom.travel_korea.tour.dto.external;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/** TourAPI detailIntro2의 원본 응답 구조입니다. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TourApiDetailIntroRawResponse(
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
     * 유형별 상세가 없는 콘텐츠도 items가 ""로 내려옵니다. 빈 Items(item == null)로 받아
     * 공통 상세만 응답하도록 합니다(TourApiClientImpl.extractDetailIntro).
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Items(List<TourApiDetailIntroItem> item) {

        @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
        static Items fromString(String ignored) {
            return new Items(null);
        }
    }
}
