package kr.co.mycom.travel_korea.tour.dto.response;

import java.util.List;

public record TourListResponse (
  List<TourSummaryResponse> items,
  int page,
  int size,
  int totalCount
) {
}
