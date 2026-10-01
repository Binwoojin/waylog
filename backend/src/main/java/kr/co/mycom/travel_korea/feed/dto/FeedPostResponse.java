package kr.co.mycom.travel_korea.feed.dto;

import kr.co.mycom.travel_korea.feed.domain.FeedPhoto;
import kr.co.mycom.travel_korea.feed.domain.FeedPost;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.function.Function;

public record FeedPostResponse(
        Long id,
        AuthorResponse author,
        String content,
        String location,
        String address,
        BigDecimal latitude,
        BigDecimal longitude,
        String tourContentId,
        Integer tourContetTypeId,
        LinkedCourseResponse linkedCourse,
        List<String> images,
        List<String> tags,
        long likeCount,
        long commentCount,
        boolean liked,
        boolean bookmarked,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public record AuthorResponse(
            Long id,
            String nickname,
            String profileImageUrl
    ) {
    }

    /*
     * 여행코스 참조 응답(tour-course-feed-linking 설계 §4.3). 스냅샷 컬럼을 그대로 읽어서
     * 만들므로 TourCourse를 조인하지 않는다. courseId/dayNumber/stopName이 null이면
     * 참조했던 코스/일자/경유지가 이후 삭제된 것이다(ON DELETE SET NULL, 설계 §5) —
     * 프론트는 그 경우 "삭제된 일정"처럼 조용히 표시한다(설계 §5.3).
     */
    public record LinkedCourseResponse(
            Long courseId, String courseTitle,
            Long dayId, Integer dayNumber,
            Long stopId, String stopName
    ) {
        public static LinkedCourseResponse from(FeedPost post) {
            if (!post.hasCourseLink()) {
                return null;
            }

            return new LinkedCourseResponse(
                    post.getLinkedCourseId(), post.getLinkedCourseTitle(),
                    post.getLinkedCourseDayId(), post.getLinkedCourseDayNumber(),
                    post.getLinkedCourseStopId(), post.getLinkedCourseStopName()
            );
        }
    }

    public static FeedPostResponse from(
            FeedPost post,
            boolean liked,
            boolean bookmarked,
            Function<String, String> imageUrlResolver
    ) {
        return new FeedPostResponse(
                post.getId(),
                new AuthorResponse(
                        post.getAuthor().getId(),
                        post.getAuthor().getNickname(),
                        post.getAuthor().getProfileImageUrl()
                ),
                post.getContent(),
                post.getLocationName(),
                post.getAddress(),
                post.getLatitude(),
                post.getLongitude(),
                post.getTourContentId(),
                post.getTourContentTypeId(),
                LinkedCourseResponse.from(post),
                post.getPhotos().stream()
                        .map(FeedPhoto::getImageUrl)
                        .map(imageUrlResolver)
                        .toList(),
                List.copyOf(post.getTags()),
                post.getLikeCount(),
                post.getCommentCount(),
                liked,
                bookmarked,
                post.getCreatedAt(),
                post.getUpdatedAt()
        );
    }
}
