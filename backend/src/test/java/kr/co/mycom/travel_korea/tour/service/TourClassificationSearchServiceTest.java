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
 * Design Ref: §4.3 BE-5 — BE-2 중분류 원본 조회 상한(20페이지) 단위 테스트
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

    @Test
    @DisplayName("totalCount가 2,500이면 원본 조회는 상한인 20회에서 멈춘다")
    void stopsAtMaxSourcePages() {
        var client = new CountingTourApiClient(2_500);
        var service = new TourClassificationSearchService(client, mapper());

        var grouped = service.findAllGroupedByMiddleClassification(null, null, 14, "Q", "VE");

        assertThat(client.areaBasedListCalls).isEqualTo(TourClassificationSearchService.MAX_SOURCE_PAGES);
        assertThat(client.areaBasedListCalls).isEqualTo(20);
        // 앞 2,000건만 걸러 내므로 VE07·VE08이 1,000건씩입니다.
        assertThat(grouped.get("VE07")).hasSize(1_000);
        assertThat(grouped.get("VE08")).hasSize(1_000);
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
