package kr.co.mycom.travel_korea.tour.client;

import kr.co.mycom.travel_korea.tour.dto.external.*;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 실제 TourAPI가 완성되기 전 사용하는 임시 데이터 제공자입니다.
 *
 * local-mock 프로필에서만 사용됩니다.
 *
 * TODO(팀원 A):
 * 실제 TourApiClientImpl이 완성되면 기본 실행에서는
 * 실제 구현체를 사용하도록 변경해 주세요.
 */
@Component
@Profile("local-mock")
public class MockTourApiClient implements TourApiClient {

    @Override
    public TourApiResponse getAreaBasedList(
            int page,
            int size,
            Integer lDongRegnCd,
            Integer lDongSignguCd,
            Integer contentTypeId,
            String arrange
    ) {
        /*
         * 지금은 요청 조건을 실제로 처리하지 않고
         * 추천 여행지 3개를 고정으로 반환합니다.
         *
         * TODO(팀원 A):
         * 실제 구현체에서 page, size, lDongRegnCd,
         * lDongSignguCd, contentTypeId, arrange를
         * TourAPI Query Parameter로 전달해 주세요.
         */

        List<TourApiItem> items = List.of(
                new TourApiItem(
                        "126508",
                        "12",
                        "경복궁",
                        "서울특별시 종로구",
                        "사직로 161",
                        null,
                        null,
                        "11",
                        "110",
                        "126.9770170625",
                        "37.5788222356"
                ),
                new TourApiItem(
                        "126485",
                        "12",
                        "비자림",
                        "제주특별자치도 제주시 구좌읍",
                        "비자숲길 55",
                        null,
                        null,
                        "50",
                        "110",
                        "126.8114078",
                        "33.4913452"
                ),
                new TourApiItem(
                        "125476",
                        "12",
                        "경포해변",
                        "강원특별자치도 강릉시",
                        "창해로",
                        null,
                        null,
                        "51",
                        "150",
                        "128.9071180",
                        "37.8056495"
                )
        );

        return new TourApiResponse(
                items,
                page,
                size,
                items.size()
        );
    }

    @Override
    public TourApiCourseIntroItem getCourseIntro(String contentId) {
        return new TourApiCourseIntroItem(
                contentId,
                "25",
                "약 20km",
                "관광안내소",
                "당일 코스",
                "약 5시간",
                "지역의 주요 관광지를 둘러보는 코스"
        );
    }

    @Override
    public List<TourApiCourseDetailItem> getCourseDetails(String contentId) {
        return List.of(
                new TourApiCourseDetailItem(
                        contentId,
                        "25",
                        "mock-1",
                        null,
                        null,
                        "첫 번째 경유지입니다.",
                        "첫 번째 장소",
                        0
                ),
                new TourApiCourseDetailItem(
                        contentId,
                        "25",
                        "mock-2",
                        null,
                        null,
                        "두 번째 경유지입니다.",
                        "두 번째 장소",
                        1
                )
        );
    }

    @Override
    public List<TourApiRegionItem> getRegionCodes(Integer lDongRegnCd) {
        if (lDongRegnCd == null) {
            return List.of(
                    new TourApiRegionItem("11", null, "서울", null),
                    new TourApiRegionItem("26", null, "부산", null),
                    new TourApiRegionItem("50", null, "제주", null)
            );
        }
        if (lDongRegnCd == 11) {
            return List.of(
                    new TourApiRegionItem("11", "440", "서울", "마포구"),
                    new TourApiRegionItem("11", "215", "서울", "광진구")
            );
        }
        return List.of(new TourApiRegionItem(
                String.valueOf(lDongRegnCd), "100", "선택 지역", "중심 지역"
        ));
    }

    @Override
    public TourApiFestivalResponse getFestivals(
            int page, int size, Integer lDongRegnCd, Integer lDongSignguCd,
            String eventStartDate, String eventEndDate, String arrange
    ) {
        var item = new TourApiFestivalItem(
                "mock-festival-1", "15", "WayLog 지역 축제",
                "서울특별시 종로구", null, null, null,
                "11", lDongSignguCd == null ? "110" : String.valueOf(lDongSignguCd),
                "126.97", "37.57",
                eventStartDate, eventEndDate
        );
        return new TourApiFestivalResponse(List.of(item), page, size, 1);
    }

    @Override
    public TourApiDetailCommonItem getDetailCommon(String contentId, Integer contentTypeId) {
        return null;
    }

    @Override
    public TourApiDetailIntroItem getDetailIntro(String contentId, Integer contentTypeId) {
        return null;
    }
}
