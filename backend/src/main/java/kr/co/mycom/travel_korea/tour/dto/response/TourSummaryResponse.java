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
        String lclsSystm3Nm,

        // 현재 로그인 사용자의 북마크 여부(비로그인은 항상 false)
        boolean bookmarked
) {
    /**
     * TourService.getTours()/getToursByRegionGroup()은 Caffeine 캐시(tourLists)에
     * 결과를 저장하므로, TourMapper가 이 레코드를 만들 때는 항상 bookmarked=false만
     * 넣어야 합니다(TourDetailResponse.withBookmarked와 같은 이유). 실제 값은 캐시를
     * 거치지 않는 TourController에서 이 메서드로 덮어씁니다.
     */
    public TourSummaryResponse withBookmarked(boolean bookmarked) {
        return new TourSummaryResponse(
                contentId,
                contentTypeId,
                title,
                address,
                image,
                thumbnail,
                lDongRegnCd,
                lDongSignguCd,
                latitude,
                longitude,
                lclsSystm1,
                lclsSystm1Nm,
                lclsSystm2,
                lclsSystm2Nm,
                lclsSystm3,
                lclsSystm3Nm,
                bookmarked
        );
    }
}
