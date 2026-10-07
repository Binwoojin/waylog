package kr.co.mycom.travel_korea.tour.client;

import kr.co.mycom.travel_korea.tour.dto.external.*;
import kr.co.mycom.travel_korea.tour.exception.TourContentNotFoundException;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

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

    /** 홈·상세와 공유하는 기존 목록 3건입니다. 순서를 바꾸면 홈(/api/v1/home) 목 응답이 달라집니다. */
    private static final List<TourApiItem> BASE_ITEMS = List.of(
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

    /**
     * 합성 항목에 돌려 배정하는 지역 코드입니다.
     * 31(울산)은 일부러 넣지 않아, lDongRegnCd=31이면 항상 빈 결과가 나옵니다(빈 상태 확인용).
     */
    private static final List<String> SYNTHETIC_REGION_CODES = List.of("11", "26", "50", "51");

    private static final Map<String, String> REGION_NAMES = Map.of(
            "11", "서울특별시",
            "26", "부산광역시",
            "50", "제주특별자치도",
            "51", "강원특별자치도"
    );

    /** 지역별 대략적인 중심 좌표 {경도, 위도}입니다. */
    private static final Map<String, double[]> REGION_CENTERS = Map.of(
            "11", new double[]{126.9780, 37.5665},
            "26", new double[]{129.0756, 35.1796},
            "50", new double[]{126.5312, 33.4996},
            "51", new double[]{127.7298, 37.8813}
    );

    /** 문화시설(14) 합성 항목에 돌려 배정하는 중분류입니다(프론트 문화시설 탭과 같은 값). */
    private static final List<String> CULTURE_MIDDLE_CLASSIFICATIONS = List.of("VE06", "VE07", "VE08", "VE09");

    private static final int SYNTHETIC_ATTRACTION_COUNT = 20;
    private static final int SYNTHETIC_CULTURE_COUNT = 11;

    /** 관광지(12): 기존 3건을 맨 앞에 두고 합성 20건을 이어 붙인 23건입니다. */
    private static final List<TourApiItem> ATTRACTION_ITEMS = Stream.concat(
            BASE_ITEMS.stream(),
            IntStream.rangeClosed(1, SYNTHETIC_ATTRACTION_COUNT)
                    .mapToObj(seq -> syntheticItem(12, "목 관광지", seq, null, null))
    ).toList();

    /** 문화시설(14): 합성 11건입니다. 중분류 경로(TourClassificationSearchService)가 lclsSystm2로 묶습니다. */
    private static final List<TourApiItem> CULTURE_ITEMS = IntStream.rangeClosed(1, SYNTHETIC_CULTURE_COUNT)
            .mapToObj(seq -> syntheticItem(
                    14, "목 문화시설", seq,
                    "VE", CULTURE_MIDDLE_CLASSIFICATIONS.get((seq - 1) % CULTURE_MIDDLE_CLASSIFICATIONS.size())
            ))
            .toList();

    /** 합성 항목 contentId → 항목. 상세(getDetailCommon)가 목록과 같은 제목을 돌려주게 합니다. */
    private static final Map<String, TourApiItem> SYNTHETIC_ITEMS_BY_ID = Stream.concat(
            ATTRACTION_ITEMS.stream().skip(BASE_ITEMS.size()),
            CULTURE_ITEMS.stream()
    ).collect(Collectors.toUnmodifiableMap(TourApiItem::contentid, Function.identity()));

    /**
     * Design Ref: §4.3 BE-4 (Q-4) — 프론트 목록의 페이지네이션·빈 상태·문화시설 탭을
     * 실제 키 없이 확인할 수 있도록 유형·지역·page·size를 반영합니다.
     *
     * - 12: 23건, 14: 11건, 그 밖의 유형: 기존 3건(contenttypeid만 요청값으로)
     * - lDongRegnCd·lDongSignguCd로 걸러 낸 뒤 page·size로 자릅니다.
     * - numOfRows는 잘린 건수, totalCount는 필터 후 전체 건수입니다(마지막 페이지 size가 줄어드는 실제 동작 재현).
     * - 분류(lclsSystm1·2)는 8개 인자 default 메서드가 버리므로 여기서 적용하지 않습니다.
     *   14의 중분류는 서버 측 필터(TourClassificationSearchService)에서 적용되고,
     *   12의 대분류는 적용되지 않습니다(탭을 바꿔도 같은 목록, 목의 한계).
     * - arrange는 무시합니다.
     */
    @Override
    public TourApiResponse getAreaBasedList(
            int page,
            int size,
            Integer lDongRegnCd,
            Integer lDongSignguCd,
            Integer contentTypeId,
            String arrange
    ) {
        List<TourApiItem> filtered = itemsForContentType(contentTypeId).stream()
                .filter(item -> lDongRegnCd == null
                        || String.valueOf(lDongRegnCd).equals(item.lDongRegnCd()))
                .filter(item -> lDongSignguCd == null
                        || String.valueOf(lDongSignguCd).equals(item.lDongSignguCd()))
                .toList();

        int fromIndex = Math.min(Math.max(page - 1, 0) * size, filtered.size());
        int toIndex = Math.min(fromIndex + size, filtered.size());
        List<TourApiItem> pageItems = filtered.subList(fromIndex, toIndex);

        return new TourApiResponse(
                pageItems,
                page,
                pageItems.size(),
                filtered.size()
        );
    }

    private static List<TourApiItem> itemsForContentType(Integer contentTypeId) {
        if (contentTypeId == null || contentTypeId == 12) {
            return ATTRACTION_ITEMS;
        }
        if (contentTypeId == 14) {
            return CULTURE_ITEMS;
        }
        String typeId = String.valueOf(contentTypeId);
        return BASE_ITEMS.stream()
                .map(item -> new TourApiItem(
                        item.contentid(), typeId, item.title(), item.addr1(), item.addr2(),
                        item.firstimage(), item.firstimage2(), item.lDongRegnCd(), item.lDongSignguCd(),
                        item.mapx(), item.mapy()
                ))
                .toList();
    }

    /**
     * 합성 항목을 만듭니다. contentId = 9{typeId}{순번 4자리} (예: 9120004, 9140001).
     * 이미지는 null로 두어 프론트 기본 이미지 경로를 확인할 수 있게 합니다.
     */
    private static TourApiItem syntheticItem(
            int typeId, String titlePrefix, int seq, String lclsSystm1, String lclsSystm2
    ) {
        String regionCode = SYNTHETIC_REGION_CODES.get((seq - 1) % SYNTHETIC_REGION_CODES.size());
        String signguCode = syntheticSignguCode(regionCode, seq);
        double[] center = REGION_CENTERS.get(regionCode);

        return new TourApiItem(
                "9" + typeId + String.format("%04d", seq),
                String.valueOf(typeId),
                String.format("%s %02d", titlePrefix, seq),
                REGION_NAMES.get(regionCode) + " " + syntheticDistrictName(regionCode, signguCode),
                null,
                null,
                null,
                regionCode,
                signguCode,
                String.format(Locale.ROOT, "%.4f", center[0] + seq * 0.001),
                String.format(Locale.ROOT, "%.4f", center[1] + seq * 0.001),
                lclsSystm1,
                lclsSystm2,
                null
        );
    }

    /**
     * getRegionCodes 목 응답의 시군구 코드와 맞춥니다.
     * 서울(11)은 마포구(440)·광진구(215)를 번갈아, 그 밖의 지역은 "100"(중심 지역)을 씁니다.
     */
    private static String syntheticSignguCode(String regionCode, int seq) {
        if ("11".equals(regionCode)) {
            int nthInRegion = (seq - 1) / SYNTHETIC_REGION_CODES.size();
            return nthInRegion % 2 == 0 ? "440" : "215";
        }
        return "100";
    }

    private static String syntheticDistrictName(String regionCode, String signguCode) {
        if ("11".equals(regionCode)) {
            return "440".equals(signguCode) ? "마포구" : "광진구";
        }
        return "중심 지역";
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
     * - 여행지 유형(12, 14)으로 요청하면 저장된 실제 유형을 그대로 반환합니다.
     *   그래서 126508?contentTypeId=14는 실제 TourAPI와 같이 404가 됩니다.
     *   합성 항목도 같습니다(9140001?contentTypeId=12 → 404).
     * - 즐기기 유형(15, 28, 32, 38, 39)으로 요청하면 요청 유형을 그대로 돌려줍니다.
     *   목에는 즐기기용 데이터가 없으므로, 목록 3건을 즐기기 상세 성공 경로 확인에
     *   재사용하기 위한 목 전용 동작입니다(/enjoy/festivals/126485 등).
     */
    @Override
    public TourApiDetailCommonItem getDetailCommon(String contentId, Integer contentTypeId) {
        TourApiDetailCommonItem item = MOCK_DETAIL_COMMONS.get(contentId);
        if (item == null) {
            item = syntheticDetailCommon(contentId);
        }

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

    /**
     * Design Ref: §4.3 BE-4 — 합성 목록 항목도 같은 제목의 상세를 돌려줘
     * 카드 → 상세 제목 일치를 확인할 수 있게 합니다. 없는 id면 null입니다.
     */
    private static TourApiDetailCommonItem syntheticDetailCommon(String contentId) {
        TourApiItem item = SYNTHETIC_ITEMS_BY_ID.get(contentId);
        if (item == null) {
            return null;
        }
        return new TourApiDetailCommonItem(
                item.contentid(),
                Integer.valueOf(item.contenttypeid()),
                item.title(),
                null,
                null,
                item.addr1(),
                item.addr2(),
                item.mapx(),
                item.mapy(),
                item.title() + "은(는) local-mock 프로필에서 목록 확인용으로 만든 합성 항목입니다.<br>"
                        + "실제 관광정보가 아닙니다."
        );
    }

    @Override
    public TourApiDetailIntroItem getDetailIntro(String contentId, Integer contentTypeId) {
        return null;
    }
}
