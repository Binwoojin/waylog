package kr.co.mycom.travel_korea.tour.dto.response;

/** 축제 카드에 필요한 정보와 행사 기간을 함께 반환합니다. */
public record TourFestivalItemResponse(
        String contentId,
        String contentTypeId,
        String title,
        String address,
        String image,
        String thumbnail,
        String lDongRegnCd,
        String lDongSignguCd,
        Double latitude,
        Double longitude,
        String startDate,
        String endDate,
        String lclsSystm1,
        String lclsSystm1Nm,
        String lclsSystm2,
        String lclsSystm2Nm,
        String lclsSystm3,
        String lclsSystm3Nm
) {
}
