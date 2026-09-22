package kr.co.mycom.travel_korea.tour.service;

import kr.co.mycom.travel_korea.tour.client.TourApiClient;
import kr.co.mycom.travel_korea.tour.dto.response.TourCourseResponse;
import kr.co.mycom.travel_korea.tour.dto.response.TourListResponse;
import kr.co.mycom.travel_korea.tour.mapper.TourMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Comparator;

/**
 * WayLog 관광정보 조회 기능의 비즈니스 로직을 담당합니다.
 *
 * 외부 TourAPI를 직접 호출하지 않고 TourApiClient 인터페이스를
 * 통해 데이터를 조회합니다.
 */

@Service
@RequiredArgsConstructor
public class TourService {
    private static final Map<String, List<Integer>> REGION_GROUPS = Map.of(
            "gyeonggi-incheon", List.of(41, 28),
            "chungcheong", List.of(43, 44, 30, 36110),
            "jeolla", List.of(12, 52),
            "gyeongsang", List.of(47, 48, 26, 27, 31)
    );
    private final TourApiClient tourApiClient;
    private final TourMapper tourMapper;
    private final TourClassificationSearchService classificationSearchService;
    private final TourRegionGroupSourceService regionGroupSourceService;
    private final TourCourseSearchSourceService courseSearchSourceService;


    // 관광정보 목록을 조회하고 WayLog 응답 형식으로 변환
    @Cacheable(
            cacheNames = "tourLists",
            key = "#page + ':' +" +
                    "#size + ':' +" +
                    "#lDongRegnCd + ':' +" +
                    "#lDongSignguCd + ':' +" +
                    "#contentTypeId + ':' +" +
                    "#arrange",
            sync = true
    )
    public TourListResponse getTours(int page, int size, Integer lDongRegnCd, Integer lDongSignguCd, Integer contentTypeId, String arrange) {

        return getTours(
                page, size, lDongRegnCd, lDongSignguCd,
                contentTypeId, arrange, null, null
        );
    }

    @Cacheable(
            cacheNames = "tourLists",
            key = "#page + ':' + #size + ':' + #lDongRegnCd + ':' +" +
                    "#lDongSignguCd + ':' + #contentTypeId + ':' + #arrange + ':' +" +
                    "#lclsSystm1 + ':' + #lclsSystm2",
            sync = true
    )
    public TourListResponse getTours(
            int page,
            int size,
            Integer lDongRegnCd,
            Integer lDongSignguCd,
            Integer contentTypeId,
            String arrange,
            String lclsSystm1,
            String lclsSystm2
    ) {

        validateRequest(page, size, lDongRegnCd, lDongSignguCd);

        /*
         * 여행코스는 TourAPI에 법정동 조건을 직접 전달하면 오류가 발생합니다.
         * 캐시된 전국 코스 원본에서 지역·시군구·중분류를 필터링합니다.
         */
        if (Integer.valueOf(25).equals(contentTypeId)
                && (lDongRegnCd != null
                || lDongSignguCd != null
                || (lclsSystm2 != null && !lclsSystm2.isBlank()))) {
            var filteredItems = courseSearchSourceService.getAll(arrange)
                    .stream()
                    .filter(item -> lDongRegnCd == null
                            || String.valueOf(lDongRegnCd).equals(item.lDongRegnCd()))
                    .filter(item -> lDongSignguCd == null
                            || String.valueOf(lDongSignguCd).equals(item.lDongSignguCd()))
                    .filter(item -> lclsSystm2 == null
                            || lclsSystm2.isBlank()
                            || lclsSystm2.equals(item.lclsSystm2()))
                    .map(tourMapper::toSummary)
                    .toList();

            int fromIndex = Math.min((page - 1) * size, filteredItems.size());
            int toIndex = Math.min(fromIndex + size, filteredItems.size());
            return new TourListResponse(
                    filteredItems.subList(fromIndex, toIndex),
                    page,
                    size,
                    filteredItems.size()
            );
        }

        /*
         * TourAPI가 중분류 파라미터를 직접 처리하지 못하므로
         * 중분류가 있으면 캐시된 서버 측 필터링 결과를 페이지로 나눕니다.
         */
        if (lclsSystm2 != null && !lclsSystm2.isBlank()) {
            var groupedItems = classificationSearchService.findAllGroupedByMiddleClassification(
                    lDongRegnCd,
                    lDongSignguCd,
                    contentTypeId,
                    arrange,
                    lclsSystm1
            );
            var filteredItems = groupedItems.getOrDefault(lclsSystm2, List.of());
            int fromIndex = Math.min((page - 1) * size, filteredItems.size());
            int toIndex = Math.min(fromIndex + size, filteredItems.size());

            return new TourListResponse(
                    filteredItems.subList(fromIndex, toIndex),
                    page,
                    size,
                    filteredItems.size()
            );
        }

        var response = tourApiClient.getAreaBasedList(
                page, size, lDongRegnCd, lDongSignguCd,
                contentTypeId, arrange, lclsSystm1, null
        );
        var items = response.items().stream().map(tourMapper::toSummary).toList();

        return new TourListResponse(
                items,
                response.pageNo(),
                response.numOfRows(),
                response.totalCount()
        );
    }

    /**
     * 경기·인천처럼 여러 광역지역을 하나의 화면 권역으로 묶어 조회합니다.
     * 권역별 결과는 캐시되며, 합친 뒤 요청 정렬과 페이지 범위를 적용합니다.
     */
    @Cacheable(
            cacheNames = "tourLists",
            key = "'group:' + #regionGroup + ':' + #page + ':' + #size + ':' + #contentTypeId + ':' + #arrange",
            sync = true
    )
    public TourListResponse getToursByRegionGroup(
            int page,
            int size,
            String regionGroup,
            Integer contentTypeId,
            String arrange
    ) {
        validateRequest(page, size, null, null);
        List<Integer> regionCodes = REGION_GROUPS.get(regionGroup);
        if (regionCodes == null) {
            throw new IllegalArgumentException("지원하지 않는 regionGroup입니다: " + regionGroup);
        }

        /* 각 지역의 캐시된 최대 100건을 합친 뒤 요청한 페이지 범위만 자릅니다. */
        var responses = regionCodes.stream()
                .map(code -> regionGroupSourceService.getRegionSource(
                        code, contentTypeId, arrange
                ))
                .toList();

        Comparator<kr.co.mycom.travel_korea.tour.dto.external.TourApiItem> comparator =
                Comparator.comparing(
                        item -> item.title() == null ? "" : item.title(),
                        String.CASE_INSENSITIVE_ORDER
                );
        if (!"A".equalsIgnoreCase(arrange)) {
            /* 수정일 필드는 현재 DTO에 없으므로 TourAPI가 준 지역별 순서를 최대한 보존합니다. */
            comparator = (left, right) -> 0;
        }

        var merged = responses.stream()
                .flatMap(response -> response.items().stream())
                .sorted(comparator)
                .toList();
        int from = Math.min((page - 1) * size, merged.size());
        int to = Math.min(from + size, merged.size());
        int totalCount = responses.stream().mapToInt(response -> response.totalCount()).sum();

        return new TourListResponse(
                merged.subList(from, to).stream().map(tourMapper::toSummary).toList(),
                page,
                size,
                totalCount
        );
    }

    // 기본적인 목록 요청값을 검증
    private void validateRequest(int page, int size, Integer lDongRegnCd, Integer lDongSignguCd) {
        if (page < 1) {
            throw new IllegalArgumentException("page는 1 이상이어야 합니다.");
        }

        if (size < 1 || size > 100) {
            throw new IllegalArgumentException("size는 1 이상 100 이하여야 합니다.");
        }

        if (lDongRegnCd == null && lDongSignguCd != null) {
            throw new IllegalArgumentException("lDongSignguCd 사용하려면 lDongRegnCd가 필요합니다.");
        }
    }

    /**
     * 메인 화면에서 사용할 추천 여행코스를 조회합니다.
     *
     * 먼저 areaBasedList2에서 여행코스 기본정보를 조회한 뒤,
     * 각 코스의 detailIntro2와 detailInfo2를 추가로 조회합니다.
     */

    @Cacheable(
            cacheNames = "recommendedCourses",
            key = "#size",
            sync = true
    )
    public List<TourCourseResponse> getRecommendedCourses(
            int size
    ) {
        /*
         * contentTypeId=25:
         * TourAPI의 여행코스 유형입니다.
         *
         * arrange=Q:
         * 대표 이미지가 있는 최근 수정 코스를 조회합니다.
         */
        var courseList = tourApiClient.getAreaBasedList(
                1,
                size,
                null,
                null,
                25,
                "Q"
        );

        return courseList.items()
                .stream()
                .map(item -> {

                    return new TourCourseResponse(
                            item.contentid(),
                            item.contenttypeid(),
                            firstNonBlank(
                                    item.firstimage(),
                                    item.firstimage2()
                            ),
                            item.title(),
                            extractRegion(item.addr1()),
                            /*
                             * taketime이 없을 경우 다른 코스 정보를 이용해
                             * 대체 일정을 생성합니다.
                             */
                            "상세 일정 확인",
                            null,
                            List.of()
                    );
                })
                .toList();
    }



    /**
     * 여러 이미지 중 처음으로 값이 있는 이미지를 선택합니다.
     */
    private String firstNonBlank(
            String first,
            String second
    ) {
        if (first != null && !first.isBlank()) {
            return first;
        }

        if (second != null && !second.isBlank()) {
            return second;
        }

        return null;
    }

    /**
     * 전체 주소에서 화면에 사용할 지역명을 추출합니다.
     *
     * 예:
     * "부산광역시 해운대구" → "부산광역시"
     */
    private String extractRegion(String address) {
        if (address == null || address.isBlank()) {
            return "전국";
        }

        return address.split("\\s+")[0];
    }

}
