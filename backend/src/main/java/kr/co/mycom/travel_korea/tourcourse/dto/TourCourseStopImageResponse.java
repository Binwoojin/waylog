package kr.co.mycom.travel_korea.tourcourse.dto;

import kr.co.mycom.travel_korea.tourcourse.domain.TourCourseStopImage;

import java.util.function.Function;

/**
 * 경유지 이미지 응답 (admin-dashboard 설계 §3.3.5).
 *
 * url은 objectKey를 그대로 내려주지 않고 StorageService.createReadUrl(objectKey)로
 * 응답 시점에 변환한다(기존 board/feed 관례).
 */
public record TourCourseStopImageResponse(Long id, String url, int sortOrder) {

    public static TourCourseStopImageResponse from(TourCourseStopImage image, Function<String, String> urlResolver) {
        return new TourCourseStopImageResponse(
                image.getId(),
                urlResolver.apply(image.getObjectKey()),
                image.getSortOrder()
        );
    }
}
