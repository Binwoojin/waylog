package kr.co.mycom.travel_korea.feed.dto;

import java.util.List;

/*
 * mypage-bookmarks 설계 §3.4: 내 피드 북마크 목록 응답.
 *
 * FeedProfileResponse와 같은 offset 페이지네이션 모양을 그대로 따른다(마이페이지/북마크
 * 화면 전체의 페이지네이션 방식을 하나로 통일 — 메인 피드 타임라인의 커서 방식과는
 * 별개 영역이라 혼용해도 일관성 문제가 없다).
 */
public record FeedBookmarkPageResponse(
        List<FeedPostResponse> posts,
        int currentPage,
        int totalPages,
        boolean hasNext
) {
}
