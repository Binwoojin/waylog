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
