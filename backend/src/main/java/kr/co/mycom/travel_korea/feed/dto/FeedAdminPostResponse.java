package kr.co.mycom.travel_korea.feed.dto;

import kr.co.mycom.travel_korea.feed.domain.FeedPhoto;
import kr.co.mycom.travel_korea.feed.domain.FeedPost;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.function.Function;

/**
 * 관리자 피드 상세 응답 (admin-dashboard 설계 §3.4.4)
 *
 * 소프트 삭제된 게시물도 조회할 수 있어야 하므로(공개 상세와 달리 deletedAt 필터를
 * 걸지 않는다, FeedPostRepository.findWithDetailsById 재사용) status/deletedAt/deleteReason을
 * 추가로 포함한다. 정지 사유와 마찬가지로 이 정보는 관리자 응답에만 포함한다(설계 §7).
 */
public record FeedAdminPostResponse(
        Long id,
        Long authorId,
        String authorNickname,
        String content,
        String locationName,
        String address,
        BigDecimal latitude,
        BigDecimal longitude,
        FeedPostResponse.LinkedCourseResponse linkedCourse,
        List<String> images,
        List<String> tags,
        long likeCount,
        long commentCount,
        String status,
        LocalDateTime deletedAt,
        String deleteReason,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    /*
     * 참조한 여행코스 정보(tour-course-feed-linking 설계 §4.5/D-6). 공개 응답
     * (FeedPostResponse.LinkedCourseResponse)과 같은 모양이 필요하므로 그대로 재사용한다
     * (별도 타입을 만들지 않음). AdminFeedDetailPage가 이 필드로 "참조한 여행코스:
     * OO코스 · N일차 · 경유지명"을 읽기 전용으로 표시한다.
     */
    public static FeedAdminPostResponse from(FeedPost post, Function<String, String> imageUrlResolver) {
        return new FeedAdminPostResponse(
                post.getId(),
                post.getAuthor().getId(),
                post.getAuthor().getNickname(),
                post.getContent(),
                post.getLocationName(),
                post.getAddress(),
                post.getLatitude(),
                post.getLongitude(),
                FeedPostResponse.LinkedCourseResponse.from(post),
                post.getPhotos().stream()
                        .map(FeedPhoto::getImageUrl)
                        .map(imageUrlResolver)
                        .toList(),
                List.copyOf(post.getTags()),
                post.getLikeCount(),
                post.getCommentCount(),
                post.isDeleted() ? "SOFT_DELETED" : "ACTIVE",
                post.getDeletedAt(),
                post.getDeleteReason(),
                post.getCreatedAt(),
                post.getUpdatedAt()
        );
    }
}
