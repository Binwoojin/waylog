package kr.co.mycom.travel_korea.feed.dto;

/**
 * code-review Should Improve — 댓글 삭제 API가 204만 반환하면 프론트가 감소량(1+답글 수)을
 * 삭제 확인 시점의 로컬 state로 추정해야 해, 동시에 다른 사용자가 답글을 추가하면 어긋날 수
 * 있었다. 서버가 실제로 삭제한 개수(removedCount)를 응답 본문에 담아 반환한다.
 */
public record FeedCommentDeleteResponse(long removedCount) {
}
