package kr.co.mycom.travel_korea.tour.service;

import kr.co.mycom.travel_korea.tour.client.TourApiClient;
import kr.co.mycom.travel_korea.tour.data.LocalClassificationCatalog;
import kr.co.mycom.travel_korea.tour.dto.external.*;
import kr.co.mycom.travel_korea.tour.mapper.TourMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Design Ref: §4.3 BE-5 — BE-2 중분류 원본 조회 상한(MAX_SOURCE_PAGES, 현재 30페이지) 단위 테스트
 */
class TourClassificationSearchServiceTest {

    /** totalCount만 정해 두고 요청마다 100건씩 돌려주는 가짜 클라이언트입니다. 호출 횟수를 셉니다. */
    private static final class CountingTourApiClient implements TourApiClient {
        private final int totalCount;
        private int areaBasedListCalls;

        private CountingTourApiClient(int totalCount) {
            this.totalCount = totalCount;
        }

        @Override
        public TourApiResponse getAreaBasedList(
                int page, int size, Integer lDongRegnCd, Integer lDongSignguCd,
                Integer contentTypeId, String arrange
        ) {
            areaBasedListCalls++;
            int from = (page - 1) * size;
            int count = Math.max(0, Math.min(size, totalCount - from));
            List<TourApiItem> items = IntStream.range(0, count)
                    .mapToObj(i -> new TourApiItem(
                            String.valueOf(from + i), "14", "문화시설 " + (from + i),
                            null, null, null, null, "11", "110", null, null,
                            "VE", (from + i) % 2 == 0 ? "VE07" : "VE08", null
                    ))
                    .toList();
            return new TourApiResponse(items, page, items.size(), totalCount);
        }

        @Override
        public TourApiCourseIntroItem getCourseIntro(String contentId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<TourApiCourseDetailItem> getCourseDetails(String contentId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<TourApiRegionItem> getRegionCodes(Integer lDongRegnCd) {
            throw new UnsupportedOperationException();
        }

        @Override
        public TourApiFestivalResponse getFestivals(
                int page, int size, Integer lDongRegnCd, Integer lDongSignguCd,
                String eventStartDate, String eventEndDate, String arrange
        ) {
            throw new UnsupportedOperationException();
        }

        @Override
        public TourApiDetailCommonItem getDetailCommon(String contentId, Integer contentTypeId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public TourApiDetailIntroItem getDetailIntro(String contentId, Integer contentTypeId) {
            throw new UnsupportedOperationException();
        }
    }

    private static TourMapper mapper() {
        return new TourMapper(new LocalClassificationCatalog(new ObjectMapper()));
    }

    private static final int MAX_PAGES = TourClassificationSearchService.MAX_SOURCE_PAGES;
    private static final int BATCH = TourClassificationSearchService.BATCH_SIZE;

    @Test
    @DisplayName("totalCount가 상한을 넘으면(상한 + 5페이지) 원본 조회는 상한 횟수에서 멈춘다")
    void stopsAtMaxSourcePages() {
        var client = new CountingTourApiClient((MAX_PAGES + 5) * BATCH);   // 현재 상한 30 → 3,500건
        var service = new TourClassificationSearchService(client, mapper());

        var grouped = service.findAllGroupedByMiddleClassification(null, null, 14, "Q", "VE");

        assertThat(client.areaBasedListCalls).isEqualTo(MAX_PAGES);
        // 앞 (상한 × 100)건만 걸러 내므로 VE07·VE08이 절반씩입니다.
        assertThat(grouped.get("VE07")).hasSize(MAX_PAGES * BATCH / 2);
        assertThat(grouped.get("VE08")).hasSize(MAX_PAGES * BATCH / 2);
    }

    @Test
    @DisplayName("totalCount가 정확히 상한 × 100이면 상한 횟수로 전부 조회한다(경계)")
    void fetchesExactlyMaxPages() {
        var client = new CountingTourApiClient(MAX_PAGES * BATCH);
        var service = new TourClassificationSearchService(client, mapper());

        var grouped = service.findAllGroupedByMiddleClassification(null, null, 14, "Q", "VE");

        assertThat(client.areaBasedListCalls).isEqualTo(MAX_PAGES);
        assertThat(grouped.get("VE07").size() + grouped.get("VE08").size()).isEqualTo(MAX_PAGES * BATCH);
    }

    @Test
    @DisplayName("실제 문화시설 전국 건수(2,744건, 28페이지)는 상한 안에서 전부 조회한다")
    void fetchesRealCultureCountWithinLimit() {
        var client = new CountingTourApiClient(2_744);
        var service = new TourClassificationSearchService(client, mapper());

        var grouped = service.findAllGroupedByMiddleClassification(null, null, 14, "Q", "VE");

        assertThat(client.areaBasedListCalls).isEqualTo(28).isLessThanOrEqualTo(MAX_PAGES);
        assertThat(grouped.get("VE07").size() + grouped.get("VE08").size()).isEqualTo(2_744);
    }

    @Test
    @DisplayName("totalCount가 250이면 원본 조회는 3회다")
    void fetchesAllPagesUnderLimit() {
        var client = new CountingTourApiClient(250);
        var service = new TourClassificationSearchService(client, mapper());

        var grouped = service.findAllGroupedByMiddleClassification(null, null, 14, "Q", "VE");

        assertThat(client.areaBasedListCalls).isEqualTo(3);
        assertThat(grouped.get("VE07")).hasSize(125);
        assertThat(grouped.get("VE08")).hasSize(125);
    }
}
