package kr.co.mycom.travel_korea.tour.dto.external;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** TourAPI ldongCode2가 반환하는 법정동 지역 코드입니다. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TourApiRegionItem(
        String lDongRegnCd,
        String lDongSignguCd,
        String lDongRegnNm,
        String lDongSignguNm
) {
}
