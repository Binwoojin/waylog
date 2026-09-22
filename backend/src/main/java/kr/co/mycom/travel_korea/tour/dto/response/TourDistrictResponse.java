package kr.co.mycom.travel_korea.tour.dto.response;

import com.fasterxml.jackson.annotation.JsonAlias;

/** 특정 광역지역에 속한 시군구 선택 항목입니다. */
public record TourDistrictResponse(
        String lDongRegnCd,
        String lDongSignguCd,
        /*
         * districts.json의 lDongSignguNm을
         * WayLog 응답의 name으로 변환합니다.
         */
        @JsonAlias("lDongSignguNm")
        String name,
        /*
         * districts.json의 lDongRegnNm을
         * WayLog 응답의 regionName으로 변환합니다.
         */
        @JsonAlias("lDongRegnNm")
        String regionName
) {
}
