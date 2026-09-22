package kr.co.mycom.travel_korea.feed.dto;

import kr.co.mycom.travel_korea.feed.domain.FeedComment;

import java.time.LocalDateTime;

public record FeedCommentResponse(
        Long id,
        Long postId,
        AuthorResponse author,
        String content,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public record AuthorResponse(
            Long id,
            String nickname,
            String profileImageUrl
    ) {
    }

    public static FeedCommentResponse from(FeedComment comment) {
        return new FeedCommentResponse(
                comment.getId(),
                comment.getFeedPost().getId(),
                new AuthorResponse(
                        comment.getAuthor().getId(),
                        comment.getAuthor().getNickname(),
                        comment.getAuthor().getProfileImageUrl()
                ),
                comment.getContent(),
                comment.getCreatedAt(),
                comment.getUpdatedAt()
        );
    }
}
