package kr.co.mycom.travel_korea.tour.client;

import kr.co.mycom.travel_korea.tour.dto.external.*;
import kr.co.mycom.travel_korea.tour.exception.TourContentNotFoundException;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

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

    /**
     * getAreaBasedList의 목록 3건과 같은 contentId·주소·좌표를 사용하는 공통 상세 목 데이터입니다.
     *
     * Design Ref: §4.3 BE-5 — 이미지는 null로 두어 프론트 기본 이미지 경로를,
     * overview에는 &lt;br&gt;와 &amp;nbsp;를 넣어 프론트 텍스트 정리 경로를 확인할 수 있게 합니다.
     */
    private static final Map<String, TourApiDetailCommonItem> MOCK_DETAIL_COMMONS = Map.of(
            "126508", new TourApiDetailCommonItem(
                    "126508",
                    12,
                    "경복궁",
                    null,
                    null,
                    "서울특별시 종로구",
                    "사직로 161",
                    "126.9770170625",
                    "37.5788222356",
                    "경복궁은 1395년에 세워진 조선 왕조의 법궁입니다.<br>"
                            + "근정전과 경회루를 비롯한 주요 전각을 둘러볼 수 있으며,&nbsp;"
                            + "수문장 교대식도 함께 관람할 수 있습니다.<br><br>"
                            + "야간 개장 기간에는 조명이 켜진 궁궐의 모습을 볼 수 있습니다."
            ),
            "126485", new TourApiDetailCommonItem(
                    "126485",
                    12,
                    "비자림",
                    null,
                    null,
                    "제주특별자치도 제주시 구좌읍",
                    "비자숲길 55",
                    "126.8114078",
                    "33.4913452",
                    "비자림은 수백 년 된 비자나무 수천 그루가 모여 자라는 숲입니다.<br>"
                            + "평탄한 산책로를 따라&nbsp;천천히 걸으며 삼림욕을 즐길 수 있습니다.<br>"
                            + "숲 가운데에는 오래된 새천년 비자나무가 있습니다."
            ),
            "125476", new TourApiDetailCommonItem(
                    "125476",
                    12,
                    "경포해변",
                    null,
                    null,
                    "강원특별자치도 강릉시",
                    "창해로",
                    "128.9071180",
                    "37.8056495",
                    "경포해변은 동해안을 대표하는 해수욕장입니다.<br>"
                            + "넓은 백사장과 소나무 숲이 이어져 있으며,&nbsp;"
                            + "가까운 경포호와 함께 둘러보기 좋습니다.<br><br>"
                            + "여름철에는 해수욕장이 개장합니다."
            )
    );

    /** 여행지 상세(/destinations/detail)에서 다루는 유형: 관광지(12), 문화시설(14) */
    private static final List<Integer> DESTINATION_CONTENT_TYPE_IDS = List.of(12, 14);

    /**
     * 목 데이터에 있는 contentId만 공통 상세를 반환합니다.
     * 없는 contentId는 실제 구현과 같은 계약(404)을 확인할 수 있도록 예외를 던집니다.
     *
     * contenttypeid 처리 (TourDetailService의 SI-1 유형 불일치 검증과 함께 동작):
     * - 여행지 유형(12, 14)으로 요청하면 저장된 실제 유형(12)을 그대로 반환합니다.
     *   그래서 126508?contentTypeId=14는 실제 TourAPI와 같이 404가 됩니다.
     * - 즐기기 유형(15, 28, 32, 38, 39)으로 요청하면 요청 유형을 그대로 돌려줍니다.
     *   목에는 즐기기용 데이터가 없으므로, 목록 3건을 즐기기 상세 성공 경로 확인에
     *   재사용하기 위한 목 전용 동작입니다(/enjoy/festivals/126485 등).
     */
    @Override
    public TourApiDetailCommonItem getDetailCommon(String contentId, Integer contentTypeId) {
        TourApiDetailCommonItem item = MOCK_DETAIL_COMMONS.get(contentId);

        if (item == null) {
            throw new TourContentNotFoundException(contentId);
        }

        if (contentTypeId == null || DESTINATION_CONTENT_TYPE_IDS.contains(contentTypeId)) {
            return item;
        }

        return new TourApiDetailCommonItem(
                item.contentid(),
                contentTypeId,
                item.title(),
                item.firstimage(),
                item.firstimage2(),
                item.addr1(),
                item.addr2(),
                item.mapx(),
                item.mapy(),
                item.overview()
        );
    }

    @Override
    public TourApiDetailIntroItem getDetailIntro(String contentId, Integer contentTypeId) {
        return null;
    }
}
