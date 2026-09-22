package kr.co.mycom.travel_korea.tour.service;

import kr.co.mycom.travel_korea.tour.client.TourApiClient;
import kr.co.mycom.travel_korea.tour.dto.response.TourSummaryResponse;
import kr.co.mycom.travel_korea.tour.mapper.TourMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * TourAPI가 직접 지원하지 않는 중분류(lclsSystm2) 검색을 담당합니다.
 * 외부 API에는 상위 분류까지만 전달하고, 전체 결과를 모아 중분류를
 * 서버에서 필터링합니다. 필터 결과는 캐시되어 페이지 이동 시 재사용됩니다.
 */
@Service
@RequiredArgsConstructor
public class TourClassificationSearchService {
    private static final int BATCH_SIZE = 100;

    private final TourApiClient tourApiClient;
    private final TourMapper tourMapper;

    @Cacheable(
            cacheNames = "tourLists",
            key = "'classification-source:' + #lDongRegnCd + ':' + #lDongSignguCd + ':' +" +
                    "#contentTypeId + ':' + #arrange + ':' + #lclsSystm1",
            sync = true
    )
    public Map<String, List<TourSummaryResponse>> findAllGroupedByMiddleClassification(
            Integer lDongRegnCd,
            Integer lDongSignguCd,
            Integer contentTypeId,
            String arrange,
            String lclsSystm1
    ) {
        var collected = new LinkedHashMap<String, List<TourSummaryResponse>>();
        int apiPage = 1;
        int totalPages = 1;

        do {
            var response = tourApiClient.getAreaBasedList(
                    apiPage,
                    BATCH_SIZE,
                    lDongRegnCd,
                    lDongSignguCd,
                    contentTypeId,
                    arrange,
                    lclsSystm1,
                    null
            );

            response.items().stream()
                    .filter(item -> item.lclsSystm2() != null && !item.lclsSystm2().isBlank())
                    .forEach(item -> collected
                            .computeIfAbsent(item.lclsSystm2(), ignored -> new ArrayList<>())
                            .add(tourMapper.toSummary(item)));

            // 마지막 페이지의 실제 건수로 총 페이지를 재계산하지 않습니다.
            if (apiPage == 1) {
                totalPages = Math.max(
                        1,
                        (int) Math.ceil((double) response.totalCount() / BATCH_SIZE)
                );
            }
            apiPage++;
        } while (apiPage <= totalPages);

        var immutableResult = new LinkedHashMap<String, List<TourSummaryResponse>>();
        collected.forEach((code, items) -> immutableResult.put(code, List.copyOf(items)));
        return Map.copyOf(immutableResult);
    }
}
