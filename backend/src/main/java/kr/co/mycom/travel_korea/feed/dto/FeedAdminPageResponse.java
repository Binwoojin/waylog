package kr.co.mycom.travel_korea.feed.dto;

import java.util.List;

/**
 * 관리자 피드 목록 응답 (admin-dashboard 설계 §3.4.4)
 *
 * 기존 board.dto.PageResponse(content/totalElements 등)와는 다른 모양이다.
 * 설계 §3.4.4가 { items, page, size, totalCount } 형태를 명시하고 있어
 * 그 계약을 그대로 따른다.
 */
public record FeedAdminPageResponse(
        List<FeedAdminListItemResponse> items,
        int page,
        int size,
        long totalCount
) {
}
