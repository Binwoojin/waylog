package kr.co.mycom.travel_korea.tour.dto.external;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * 한국관광공사 TourAPI가 반환하는 원본 JSON 구조를 표현합니다.
 *
 * JSON 구조:
 *
 * response
 *  ├─ header
 *  │   ├─ resultCode
 *  │   └─ resultMsg
 *  └─ body
 *      ├─ items
 *      │   └─ item[]
 *      ├─ numOfRows
 *      ├─ pageNo
 *      └─ totalCount
 *
 * ignoreUnknown = true:
 * TourAPI가 우리가 사용하지 않는 추가 필드를 반환해도
 * JSON 변환이 실패하지 않게 합니다.
 */

@JsonIgnoreProperties(ignoreUnknown = true)
public record TourApiRawResponse(Response response) {
    /**
     * 실제 API 응답의 response 객체입니다.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Response(
            Header header,
            Body body
    ) {
    }

    /**
     * TourAPI 처리 결과를 나타냅니다.
     *
     * 정상 요청이면 resultCode가 "0000"입니다.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Header(String resultCode, String resultMsg) {
    }

    /**
     * 조회된 관광정보와 페이지 정보를 포함합니다.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Body(Items items, int numOfRows, int pageNo, int totalCount) {
    }

    /**
     * 실제 관광정보 배열을 감싸는 객체입니다.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Items(List<TourApiItem> item) {
    }
}

/**
 * 왜 기존 TourApiResponse와 분리하는가?
 *
 * TourApiResponse와 TourApiRawResponse DTO의 역할이 다르다.
 * - TourApiRawResponse : 외부 TourAPI JSON을 그대로 받는 DTO
 * - TourApiResponse : WayLog의 Service가 편하게 사용하는 단순 DTO
 */


/**
 * 발표 설명
 *
 * 외부 API의 응답 구조를 Service에 그대로 노출하면
 * Service가 response.body.items.item처럼 복잡한 구조에 의존하게 됩니다.
 * 따라서 Client에서 외부 응답을 받은 뒤 WayLog 내부에서 사용하기 쉬운 TourApiResponse로 변환했습니다.
 */