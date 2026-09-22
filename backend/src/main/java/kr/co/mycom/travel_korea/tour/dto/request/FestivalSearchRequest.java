package kr.co.mycom.travel_korea.tour.dto.request;

public record FestivalSearchRequest(
        Integer page,
        Integer size,
        Integer lDongRegnCd,
        Integer lDongSignguCd,
        FestivalStatus status,
        String arrange
) {
    public FestivalSearchRequest {
        page = page == null ? 1 : page;
        size = size == null ? 9 : size;
        status = status == null ? FestivalStatus.ALL : status;
        arrange = arrange == null || arrange.isBlank() ? "Q" : arrange;
        if (page < 1) throw new IllegalArgumentException("page는 1 이상이어야 합니다.");
        if (size < 1 || size > 100) {
            throw new IllegalArgumentException("size는 1 이상 100 이하여야 합니다.");
        }

        if (lDongRegnCd == null && lDongSignguCd != null) {
            throw new IllegalArgumentException("lDongSignguCd를 사용하려면 lDongRegnCd가 필요합니다.");
        }
    }
}
