package kr.co.mycom.travel_korea.tour.dto.external;

import java.util.List;

/** Client가 Service에 전달하는 단순한 축제 조회 결과입니다. */
public record TourApiFestivalResponse(
        List<TourApiFestivalItem> items,
        int pageNo,
        int numOfRows,
        int totalCount
) {
}
