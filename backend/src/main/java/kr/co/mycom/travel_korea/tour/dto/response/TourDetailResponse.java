package kr.co.mycom.travel_korea.tour.dto.response;

import java.util.List;

/**
 * 콘텐츠 유형과 관계없이 프론트 상세페이지가 공통으로 사용하는 응답입니다.
 */

public record TourDetailResponse(
        // TourAPI 콘텐츠 식별값과 콘텐츠 유형
        String contentId,
        Integer contentTypeId,
        String contentTypeName,

        // 상단 영역에 보여 줄 기본 정보
        String title,
        String image,
        String address,
        String overview,

        // 카카오 지도와 연결할 좌표
        Double latitude,
        Double longitude,

        // 콘텐츠 유형별 상세 항목 목록
        List<TourDetailInfoResponse> detailInfos,

        // 현재 로그인 사용자의 북마크 여부(비로그인은 항상 false)
        boolean bookmarked
) {
    /**
     * TourDetailService.getDetail()은 Caffeine 캐시(tourLists)에 결과를 저장하므로
     * 이 레코드를 만들 때는 항상 bookmarked=false(비개인화 기본값)만 넣어야 합니다.
     * 사용자별 북마크 여부는 캐시 밖(컨트롤러)에서 이 메서드로 덮어씁니다.
     */
    public TourDetailResponse withBookmarked(boolean bookmarked) {
        return new TourDetailResponse(
                contentId,
                contentTypeId,
                contentTypeName,
                title,
                image,
                address,
                overview,
                latitude,
                longitude,
                detailInfos,
                bookmarked
        );
    }
}
