package kr.co.mycom.travel_korea.tour.service;

import kr.co.mycom.travel_korea.tour.client.TourApiClient;
import kr.co.mycom.travel_korea.tour.data.LocalRegionCatalog;
import kr.co.mycom.travel_korea.tour.dto.response.TourDistrictResponse;
import kr.co.mycom.travel_korea.tour.dto.response.TourRegionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TourRegionService {
    private final LocalRegionCatalog localRegionCatalog;
    private static final Map<String, List<Integer>> REGION_GROUPS = Map.of(
            "gyeonggi-incheon", List.of(41, 28),
            "chungcheong", List.of(43, 44, 30, 36110),
            "jeolla", List.of(12, 52),
            "gyeongsang", List.of(47, 48, 26, 27, 31)
    );
    private final TourApiClient tourApiClient;

    @Cacheable(cacheNames = "tourLists", key = "'regions'", sync = true)
/**
 * 외부 TourAPI를 호출하지 않고 로컬 광역지역 목록을 반환합니다.
 */
    public List<TourRegionResponse> getRegions() {
        return localRegionCatalog.getRegions();
    }


    @Cacheable(
            cacheNames = "tourLists",
            key = "'districts:' + #lDongRegnCd + ':' + #regionGroup",
            sync = true
    )
    public List<TourDistrictResponse> getDistricts(Integer lDongRegnCd, String regionGroup) {
        if (lDongRegnCd != null && regionGroup != null && !regionGroup.isBlank()) {
            throw new IllegalArgumentException("지역 코드와 권역은 동시에 사용할 수 없습니다.");
        }
        List<Integer> codes;
        if (lDongRegnCd != null) {
            return localRegionCatalog.getDistricts(
                    lDongRegnCd
            );
        }
        /*
         * 경기·인천, 충청, 전라, 경상처럼
         * 여러 광역지역을 하나의 권역으로 묶은 경우입니다.
         */
        if (regionGroup != null &&
                !regionGroup.isBlank()) {

            List<Integer> regionCodes =
                    REGION_GROUPS.get(regionGroup);

            if (regionCodes == null) {
                throw new IllegalArgumentException(
                        "지원하지 않는 regionGroup입니다."
                );
            }

            return regionCodes.stream()
                    .flatMap(regionCode ->
                            localRegionCatalog
                                    .getDistricts(regionCode)
                                    .stream()
                    )
                    .toList();
            }
            throw new IllegalArgumentException(
                    "lDongRegnCd 또는 regionGroup이 필요합니다."
            );
        }
}
