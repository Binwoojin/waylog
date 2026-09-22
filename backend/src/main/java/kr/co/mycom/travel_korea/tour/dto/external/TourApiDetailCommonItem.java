package kr.co.mycom.travel_korea.tour.dto.external;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * TourAPI detailCommon 응답의 item 데이터입니다.
 * 모든 콘텐츠 유형에서 공통으로 사용할 수 있는 기본 정보입니다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TourApiDetailCommonItem(
        String contentid,
        Integer contenttypeid,
        String title,
        String firstimage,
        String firstimage2,
        String addr1,
        String addr2,
        String mapx,
        String mapy,
        String overview
) {
}
