package kr.co.mycom.travel_korea.feed.dto;

import org.springframework.data.domain.Page;

import java.util.List;

public record FeedPageResponse(
        List<FeedPostResponse> posts,
        int currentPage,
        int pageSize,
        int totalPages,
        long totalElements,
        boolean hasNext
) {
    public static FeedPageResponse from (
            Page<?> page,
            List<FeedPostResponse> posts
    ) {
        return new FeedPageResponse(
                posts,
                page.getNumber() + 1,
                page.getSize(),
                page.getTotalPages(),
                page.getTotalElements(),
                page.hasNext()
        );
    }
}
