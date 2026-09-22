package kr.co.mycom.travel_korea.tour.dto.response;

public record TourSummaryResponse(
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
        String lclsSystm1,
        String lclsSystm1Nm,
        String lclsSystm2,
        String lclsSystm2Nm,
        String lclsSystm3,
        String lclsSystm3Nm
) {

}
