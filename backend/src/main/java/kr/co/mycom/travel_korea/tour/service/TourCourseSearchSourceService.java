package kr.co.mycom.travel_korea.tour.service;

import kr.co.mycom.travel_korea.tour.client.TourApiClient;
import kr.co.mycom.travel_korea.tour.dto.external.TourApiItem;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 법정동 조건과 함께 요청하면 오류가 발생하는 여행코스 원본을 캐시합니다.
 * 모든 지역·시군구·코스유형 검색이 동일한 원본을 공유합니다.
 */
@Service
@RequiredArgsConstructor
public class TourCourseSearchSourceService {
    // TourAPI가 numOfRows=1000 요청에서 오류 응답을 반환하므로
    // 정상 동작이 확인된 최대 100건 단위로 나누어 조회합니다.
    private static final int REQUEST_SIZE = 100;
    private static final int COURSE_CONTENT_TYPE_ID = 25;
    private static final String COURSE_CLASSIFICATION = "C01";

    private final TourApiClient tourApiClient;

    @Cacheable(
            cacheNames = "tourLists",
            key = "'course-search-source:' + #arrange",
            sync = true
    )
    public List<TourApiItem> getAll(String arrange) {
        var collected = new ArrayList<TourApiItem>();
        int apiPage = 1;
        int totalPages = 1;

        do {
            var response = tourApiClient.getAreaBasedList(
                    apiPage,
                    REQUEST_SIZE,
                    null,
                    null,
                    COURSE_CONTENT_TYPE_ID,
                    arrange,
                    COURSE_CLASSIFICATION,
                    null
            );
            collected.addAll(response.items());

            /*
             * 마지막 페이지의 numOfRows는 남은 데이터 개수로 내려옵니다.
             * 매 페이지 다시 계산하면 존재하지 않는 다음 페이지를 호출하므로
             * 전체 페이지 수는 첫 번째 응답에서 한 번만 계산합니다.
             */
            if (apiPage == 1) {
                totalPages = Math.max(
                        1,
                        (int) Math.ceil((double) response.totalCount() / REQUEST_SIZE)
                );
            }
            apiPage++;
        } while (apiPage <= totalPages);

        return List.copyOf(collected);
    }
}
