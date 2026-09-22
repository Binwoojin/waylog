package kr.co.mycom.travel_korea.tour.bookmark.dto;

/**
 * active=true면 새로 저장된 상태,
 * active=false면 기존 북마크가 해제된 상태입니다.
 */

public record TourBookmarkToggleResponse(
        boolean active,
        Long bookmarkId
) {
}
