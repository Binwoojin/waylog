package kr.co.mycom.travel_korea.tour.service;

import kr.co.mycom.travel_korea.tour.client.TourApiClient;
import kr.co.mycom.travel_korea.tour.dto.response.TourSummaryResponse;
import kr.co.mycom.travel_korea.tour.mapper.TourMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
@Service
@RequiredArgsConstructor
public class TourClassificationSearchService {
    private static final int BATCH_SIZE = 100;

    /**
     * 중분류 필터링을 위한 원본 조회 최대 페이지 수입니다. (100건 × 20 = 2,000건)
     *
     * Design Ref: §4.3 BE-2 (Q-3) — 조건 조합 1개의 첫 조회가 TourAPI 일일 한도(1,000회)를
     * 크게 소모하지 않도록 호출 수를 제한합니다. 상한을 넘으면 앞 2,000건 안에서만 걸러 내므로
     * 응답 totalCount가 실제보다 작을 수 있고, 그 빈도는 WARN 로그로 확인합니다.
     */
    static final int MAX_SOURCE_PAGES = 20;

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
                int fullPages = Math.max(
                        1,
                        (int) Math.ceil((double) response.totalCount() / BATCH_SIZE)
                );
                totalPages = Math.min(fullPages, MAX_SOURCE_PAGES);
                if (fullPages > MAX_SOURCE_PAGES) {
                    log.warn("중분류 원본 조회가 상한을 넘었습니다. totalCount={}, 조회 페이지={}/{}, 조건={}:{}:{}:{}:{}",
                            response.totalCount(), MAX_SOURCE_PAGES, fullPages,
                            lDongRegnCd, lDongSignguCd, contentTypeId, arrange, lclsSystm1);
                }
            }
            apiPage++;
        } while (apiPage <= totalPages);

        // 캐시 미스일 때만 실행되므로 조건 조합당 1줄입니다. 실제 호출량(Q-3) 확인용
        log.info("중분류 원본 조회 완료. 원본 호출 {}회, 조건={}:{}:{}:{}:{}",
                apiPage - 1, lDongRegnCd, lDongSignguCd, contentTypeId, arrange, lclsSystm1);

        var immutableResult = new LinkedHashMap<String, List<TourSummaryResponse>>();
        collected.forEach((code, items) -> immutableResult.put(code, List.copyOf(items)));
        return Map.copyOf(immutableResult);
    }
}
