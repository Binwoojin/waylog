package kr.co.mycom.travel_korea.tour.dto.request;

import java.util.Set;
import java.util.regex.Pattern;

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
    /** TourAPI areaBasedList2가 허용하는 정렬값입니다. 대소문자를 구분합니다. */
    private static final Set<String> ALLOWED_ARRANGES = Set.of("A", "C", "D", "O", "Q", "R");

    /** 중분류 코드 형식 (예: VE07). 대분류 2자리 + 숫자 2자리입니다. */
    private static final Pattern MIDDLE_CLASSIFICATION = Pattern.compile("^[A-Z]{2}\\d{2}$");

    public TourSearchRequest {
        page = page == null ? 1 : page;
        size = size == null ? 9 : size;

        // Design Ref: §4.3 BE-3 — 허용되지 않은 정렬값을 TourAPI로 그대로 보내지 않고 400 INVALID_REQUEST로 거절
        arrange = arrange == null || arrange.isBlank() ? "Q" : arrange;
        if (!ALLOWED_ARRANGES.contains(arrange)) {
            throw new IllegalArgumentException(
                    "arrange는 A, C, D, O, Q, R 중 하나여야 합니다."
            );
        }

        // Design Ref: §4.3 BE-1 — 캐시 키가 보정된 값으로 만들어지도록 서비스가 아닌 record에서 보정
        // (TourService.getTours·TourClassificationSearchService의 @Cacheable 키에 lclsSystm1이 들어감)
        if ((lclsSystm1 == null || lclsSystm1.isBlank())
                && lclsSystm2 != null
                && MIDDLE_CLASSIFICATION.matcher(lclsSystm2).matches()) {
            lclsSystm1 = lclsSystm2.substring(0, 2);
        }

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
// contentTypeId에 대한 검증을 추가합니다. (page·size·arrange는 검증 완료)
