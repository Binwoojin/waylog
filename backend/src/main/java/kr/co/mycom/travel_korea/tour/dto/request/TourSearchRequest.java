package kr.co.mycom.travel_korea.tour.dto.request;

public record TourSearchRequest (
  Integer page,
  Integer size,
  Integer lDongRegnCd,
  Integer lDongSignguCd,
  Integer contentTypeId,
  String arrange,
  String regionGroup,
  String lclsSystm1,
  String lclsSystm2
) {
    public TourSearchRequest {
        page = page == null ? 1 : page;
        size = size == null ? 9 : size;
        arrange = arrange == null || arrange.isBlank() ? "Q" : arrange;
        if (page < 1) {
            throw new IllegalArgumentException(
                    "page는 1 이상이어야 합니다."
            );
        }

        if (size < 1 || size > 100) {
            throw new IllegalArgumentException(
                    "size는 1 이상 100 이하여야 합니다."
            );
        }

        /*
         * 시군구 코드는 상위 지역 코드와 함께 사용해야 합니다.
         */
        if (lDongRegnCd == null &&
                lDongSignguCd != null) {
            throw new IllegalArgumentException(
                    "lDongSignguCd를 사용하려면 " +
                            "lDongRegnCd가 필요합니다."
            );
        }

        if (lDongRegnCd != null && regionGroup != null && !regionGroup.isBlank()) {
            throw new IllegalArgumentException(
                    "lDongRegnCd와 regionGroup은 동시에 사용할 수 없습니다."
            );
        }
    }
}


// TODO(본인):
// page, size, contentTypeId, arrange에 대한 검증을 추가합니다.
