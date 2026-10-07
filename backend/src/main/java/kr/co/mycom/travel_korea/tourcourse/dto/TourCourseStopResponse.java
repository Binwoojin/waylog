package kr.co.mycom.travel_korea.tourcourse.dto;

import kr.co.mycom.travel_korea.tourcourse.domain.StopType;
import kr.co.mycom.travel_korea.tourcourse.domain.TourCourseStop;
import kr.co.mycom.travel_korea.tourcourse.domain.TourCourseStopImage;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.function.Function;

/**
 * 여행코스 경유지 응답 (admin-dashboard 설계 §3.3.5).
 */
public record TourCourseStopResponse(
        Long id,
        int sortOrder,
        StopType stopType,
        String tourContentId,
        Integer tourContentTypeId,
        String name,
        String address,
        BigDecimal latitude,
        BigDecimal longitude,
        List<TourCourseStopImageResponse> images
) {
    public static TourCourseStopResponse from(TourCourseStop stop, Function<String, String> urlResolver) {
        return new TourCourseStopResponse(
                stop.getId(),
                stop.getSortOrder(),
                stop.getStopType(),
                stop.getTourContentId(),
                stop.getTourContentTypeId(),
                stop.getName(),
                stop.getAddress(),
                stop.getLatitude(),
                stop.getLongitude(),
                stop.getImages().stream()
                        .sorted(Comparator.comparingInt(TourCourseStopImage::getSortOrder))
                        .map(image -> TourCourseStopImageResponse.from(image, urlResolver))
                        .toList()
        );
    }
}
