package kr.co.mycom.travel_korea.feed.dto;

import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.feed.domain.FeedProfile;

import java.util.List;

public record FeedProfileResponse(
        String nickname,
        /*
         * mypage-bookmarks 설계 §3.2: 마이페이지 프로필 수정에서 추가로 노출/수정하는
         * 자기소개. 기존 필드 뒤에 추가만 해 하위 호환을 유지한다(기존 FeedUserProfilePage
         * 소비자는 이 필드를 몰라도 그대로 동작).
         */
        String introduce,
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
                user.getIntroduce(),
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
