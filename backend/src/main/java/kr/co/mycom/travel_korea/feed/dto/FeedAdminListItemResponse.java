package kr.co.mycom.travel_korea.feed.dto;

import kr.co.mycom.travel_korea.feed.domain.FeedPost;

import java.time.LocalDateTime;

/**
 * 관리자 피드 목록 행 (admin-dashboard 설계 §3.4.4)
 *
 * status는 deletedAt 유무로 서버가 계산해 내려준다(프론트가 null 체크로
 * 다시 판단하지 않도록, UserAdminResponse.suspended와 같은 원칙).
 */
public record FeedAdminListItemResponse(
        Long id,
        Long authorId,
        String authorNickname,
        String contentPreview,
        int imageCount,
        long likeCount,
        long commentCount,
        LocalDateTime createdAt,
        String status,
        LocalDateTime deletedAt,
        String deleteReason
) {
    private static final int PREVIEW_LENGTH = 50;

    public static FeedAdminListItemResponse from(FeedPost post) {
        return new FeedAdminListItemResponse(
                post.getId(),
                post.getAuthor().getId(),
                post.getAuthor().getNickname(),
                preview(post.getContent()),
                post.getPhotos().size(),
                post.getLikeCount(),
                post.getCommentCount(),
                post.getCreatedAt(),
                post.isDeleted() ? "SOFT_DELETED" : "ACTIVE",
                post.getDeletedAt(),
                post.getDeleteReason()
        );
    }

    private static String preview(String content) {
        if (content == null) {
            return null;
        }

        String trimmed = content.trim();

        if (trimmed.length() <= PREVIEW_LENGTH) {
            return trimmed;
        }

        return trimmed.substring(0, PREVIEW_LENGTH) + "...";
    }
}
