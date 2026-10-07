package kr.co.mycom.travel_korea.feed.dto;

import java.util.List;

/**
 * feed-integration 설계 §4.2(P-3), §4.2 P-10: 무한 스크롤 타임라인 응답.
 *
 * page/totalPages/totalElements 개념 대신 커서(nextCursor)를 사용한다.
 * nextCursor는 프론트가 값의 의미를 해석하지 않고 그대로 다음 요청의
 * cursor 파라미터로 되돌려 보내는 opaque 값으로 취급한다(설계 §3.2).
 *
 * 기존 FeedPageResponse는 이 타입으로 대체되어 삭제되었다(호출부가
 * FeedService.getFeed / FeedController.getFeed 뿐임을 grep으로 확인).
 */
public record FeedTimelineResponse(List<FeedPostResponse> posts, Long nextCursor, boolean hasNext) {}
