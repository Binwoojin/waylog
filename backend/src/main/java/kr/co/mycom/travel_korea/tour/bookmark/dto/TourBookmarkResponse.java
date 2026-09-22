package kr.co.mycom.travel_korea.tour.bookmark.dto;

import kr.co.mycom.travel_korea.tour.bookmark.domain.TourBookmark;
import kr.co.mycom.travel_korea.tour.bookmark.domain.TourBookmarkGroup;

import java.time.LocalDateTime;

/**
 * 북마크 목록과 토글 결과에서 사용하는 공통 응답 형식입니다.
 */

public record TourBookmarkResponse(
        Long bookmarkId,
        String contentId,
        Integer contentTypeId,
        String title,
        String imageUrl,
        String address,
        String categoryName,
        TourBookmarkGroup categoryGroup,
        LocalDateTime createdAt
) {
    public static TourBookmarkResponse from(TourBookmark bookmark) {
        return new TourBookmarkResponse(
                bookmark.getId(),
                bookmark.getContentId(),
                bookmark.getContentTypeId(),
                bookmark.getTitle(),
                bookmark.getImageUrl(),
                bookmark.getAddress(),
                bookmark.getCategoryName(),
                bookmark.getCategoryGroup(),
                bookmark.getCreatedAt()
        );
    }
}
