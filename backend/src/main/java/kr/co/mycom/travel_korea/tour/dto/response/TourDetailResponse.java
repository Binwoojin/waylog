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
        List<TourDetailInfoResponse> detailInfos
) {
}
