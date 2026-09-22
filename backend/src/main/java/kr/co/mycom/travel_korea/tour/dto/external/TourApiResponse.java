package kr.co.mycom.travel_korea.tour.dto.external;

import java.util.List;

/**
 * TourService가 사용할 단순화된 TourAPI 목록 응답입니다.
 *
 * 현재 DTO는 TourAPI의 중첩된 response/header/body/items 구조를
 * 그대로 표현하지 않고 Service에서 사용하기 편한 형태로 단순화했습니다.
 *
 * TODO(팀원 A):
 * 실제 TourAPI 응답 DTO를 별도로 만든 뒤, 실제 Client 구현체에서
 * 이 객체로 변환해 반환해 주세요.
 */

public record TourApiResponse (List<TourApiItem> items, int pageNo, int numOfRows, int totalCount) {
    /**
     * TourAPI 결과가 없더라도 items가 null이 되지 않게 처리합니다.
     */

    public TourApiResponse {
        items = items == null ? List.of() : List.copyOf(items);
    }
}
