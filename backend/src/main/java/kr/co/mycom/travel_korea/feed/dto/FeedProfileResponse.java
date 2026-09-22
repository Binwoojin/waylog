package kr.co.mycom.travel_korea.feed.dto;

import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.feed.domain.FeedProfile;

import java.util.List;

public record FeedProfileResponse(
        String nickname,
        String feedHandle,
        String profileImageUrl,

        long postCount,
        long receiveLikeCount,

        /*
         * 본인이 작성한 게시글 목록입니다.
         * 프론트의 /feed/profile 화면에서 카드로 출력합니다.
         */
        List<FeedPostResponse> posts,

        int currentPage,
        int totalPages,
        boolean hasNext
        ) {
    public static FeedProfileResponse of(
            UserEntity user,
            FeedProfile profile,
            long postCount,
            long receivedLikeCount,
            List<FeedPostResponse> posts,
            int currentPage,
            int totalPages,
            boolean hasNext
    ) {
        return new FeedProfileResponse(
                user.getNickname(),
                profile.getFeedHandle(),
                user.getProfileImageUrl(),
                postCount,
                receivedLikeCount,
                posts,
                currentPage,
                totalPages,
                hasNext
        );
    }
}
