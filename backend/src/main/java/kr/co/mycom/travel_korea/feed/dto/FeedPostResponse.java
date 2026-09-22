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
