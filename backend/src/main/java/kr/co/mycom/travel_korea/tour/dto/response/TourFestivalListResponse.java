package kr.co.mycom.travel_korea.tour.dto.response;

import java.util.List;

public record TourFestivalListResponse(
        List<TourFestivalItemResponse> items,
        int page,
        int size,
        int totalCount
) {
}
