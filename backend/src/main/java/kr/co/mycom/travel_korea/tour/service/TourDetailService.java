package kr.co.mycom.travel_korea.tour.service;

import kr.co.mycom.travel_korea.tour.client.TourApiClient;
import kr.co.mycom.travel_korea.tour.dto.external.TourApiDetailCommonItem;
import kr.co.mycom.travel_korea.tour.dto.external.TourApiDetailIntroItem;
import kr.co.mycom.travel_korea.tour.dto.response.TourDetailInfoResponse;
import kr.co.mycom.travel_korea.tour.dto.response.TourDetailResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class TourDetailService {

    private final TourApiClient tourApiClient;

    /**
     * 콘텐츠 ID와 유형을 기준으로 TourAPI 상세 정보를 조회합니다.
     *
     * 같은 상세 페이지를 다시 열 때 detailCommon2·detailIntro2를 재호출하지 않도록
     * Caffeine 캐시에 결과를 저장합니다. contentId는 콘텐츠를 식별하고,
     * contentTypeId는 유형별 detailIntro 응답을 구분하므로 둘 다 캐시 키에 포함합니다.
     */
    @Cacheable(
            cacheNames = "tourLists",
            key = "'detail:' + #contentId + ':' + #contentTypeId",
            sync = true
    )
    public TourDetailResponse getDetail(String contentId, Integer contentTypeId) {
        validateContentType(contentTypeId);

        // 1. 모든 유형에서 공통으로 필요한 기본 상세 정보 조회
        TourApiDetailCommonItem common = tourApiClient.getDetailCommon(contentId, contentTypeId);

        // 2. 콘텐츠 유형별 detailIntro 정보 조회
        TourApiDetailIntroItem intro = tourApiClient.getDetailIntro(contentId, contentTypeId);

        // 3. 프론트가 반복 출력할 label/value 목록 구성
        List<TourDetailInfoResponse> detailInfos = createDetailInfos(contentTypeId, intro);


        return new TourDetailResponse(
                common.contentid(),
                contentTypeId,
                getContentTypeName(contentTypeId),
                common.title(),
                getImage(common.firstimage(), common.firstimage2()),
                combineAddress(common.addr1(), common.addr2()),
                common.overview(),
                parseDouble(common.mapx()),
                parseDouble(common.mapy()),
                detailInfos
        );
    }

    /**
     * TourAPI 콘텐츠 유형 코드를 화면용 이름으로 변환합니다.
     */
    private String getContentTypeName(Integer contentTypeId) {
        return switch (contentTypeId) {
            case 12 -> "관광지";
            case 14 -> "문화시설";
            case 15 -> "축제 · 행사";
            case 28 -> "레포츠";
            case 32 -> "숙박";
            case 38 -> "쇼핑";
            case 39 -> "음식점";
            default -> "여행 정보";
        };
    }


    private List<TourDetailInfoResponse> createDetailInfos(Integer contentTypeId, TourApiDetailIntroItem intro) {
        // 일부 콘텐츠는 detailIntro 정보가 없을 수 있으므로 공통 상세만 보여 줍니다.
        if (intro == null) {
            return List.of();
        }

        return switch (contentTypeId) {
            case 12 -> createAttractionInfos(intro);
            case 14 -> createCultureInfos(intro);
            case 15 -> createFestivalInfos(intro);
            case 28 -> createLeportsInfos(intro);
            case 32 -> createStayInfos(intro);
            case 38 -> createShoppingInfos(intro);
            case 39 -> createFoodInfos(intro);
            default -> List.of();
        };
    }

    // 관광지
    private List<TourDetailInfoResponse> createAttractionInfos(
            TourApiDetailIntroItem intro
    ) {
        List<TourDetailInfoResponse> infos = new ArrayList<>();

        addInfo(infos, "문의 및 안내", intro.infocenter());
        addInfo(infos, "이용 시간", intro.usetime());
        addInfo(infos, "휴무일", intro.restdate());
        addInfo(infos, "주차", intro.parking());

        return infos;
    }

    // 문화시설
    private List<TourDetailInfoResponse> createCultureInfos(
            TourApiDetailIntroItem intro
    ) {
        List<TourDetailInfoResponse> infos = new ArrayList<>();

        addInfo(infos, "문의 및 안내", intro.infocenterculture());
        addInfo(infos, "관람 시간", intro.usetimeculture());
        addInfo(infos, "휴무일", intro.restdateculture());
        addInfo(infos, "관람 요금", intro.usefee());
        addInfo(infos, "주차", intro.parkingculture());

        return infos;
    }

    // 축제, 행사
    private List<TourDetailInfoResponse> createFestivalInfos(
            TourApiDetailIntroItem intro
    ) {
        List<TourDetailInfoResponse> infos = new ArrayList<>();

        addInfo(
                infos,
                "행사 기간",
                formatDateRange(intro.eventstartdate(), intro.eventenddate())
        );

        addInfo(infos, "행사 장소", intro.eventplace());
        addInfo(infos, "공연 시간", intro.playtime());
        addInfo(infos, "관람 소요 시간", intro.spendtimefestival());
        addInfo(infos, "주최", intro.sponsor1());
        addInfo(infos, "문의", intro.sponsor1tel());
        addInfo(infos, "프로그램", intro.program());

        return infos;
    }

    // 레포츠
    private List<TourDetailInfoResponse> createLeportsInfos(
            TourApiDetailIntroItem intro
    ) {
        List<TourDetailInfoResponse> infos = new ArrayList<>();

        addInfo(infos, "운영 기간", intro.openperiod());
        addInfo(infos, "이용 시간", intro.usetimeleports());
        addInfo(infos, "이용 요금", intro.usefeeleports());
        addInfo(infos, "예약 안내", intro.reservation());
        addInfo(infos, "휴무일", intro.restdateleports());
        addInfo(infos, "주차", intro.parkingleports());

        return infos;
    }

    // 숙박
    private List<TourDetailInfoResponse> createStayInfos(
            TourApiDetailIntroItem intro
    ) {
        List<TourDetailInfoResponse> infos = new ArrayList<>();

        addInfo(infos, "체크인", intro.checkintime());
        addInfo(infos, "체크아웃", intro.checkouttime());
        addInfo(infos, "객실 수", intro.roomcount());
        addInfo(infos, "예약 안내", intro.reservationlodging());
        addInfo(infos, "예약 URL", intro.reservationurl());
        addInfo(infos, "주차", intro.parkinglodging());
        addInfo(infos, "부대시설", intro.foodplace());

        return infos;
    }

    // 쇼핑
    private List<TourDetailInfoResponse> createShoppingInfos(
            TourApiDetailIntroItem intro
    ) {
        List<TourDetailInfoResponse> infos = new ArrayList<>();

        addInfo(infos, "영업 시간", intro.opentime());
        addInfo(infos, "휴무일", intro.fairday());
        addInfo(infos, "판매 품목", intro.saleitem());
        addInfo(infos, "판매 가격", intro.saleitemcost());
        addInfo(infos, "주차", intro.parkingshopping());
        addInfo(infos, "문의", intro.infocentershopping());

        return infos;
    }

    // 음식점
    private List<TourDetailInfoResponse> createFoodInfos(
            TourApiDetailIntroItem intro
    ) {
        List<TourDetailInfoResponse> infos = new ArrayList<>();

        addInfo(infos, "대표 메뉴", intro.firstmenu());
        addInfo(infos, "메뉴", intro.treatmenu());
        addInfo(infos, "영업 시간", intro.opentimefood());
        addInfo(infos, "휴무일", intro.restdatefood());
        addInfo(infos, "예약 안내", intro.reservationfood());
        addInfo(infos, "주차", intro.parkingfood());
        addInfo(infos, "문의", intro.infocenterfood());

        return infos;
    }

    /**
     * 값이 비어 있는 상세 항목은 프론트에 전달하지 않습니다.
     */
    private void addInfo(
            List<TourDetailInfoResponse> infos,
            String label,
            String value
    ) {
        if (value != null && !value.isBlank()) {
            infos.add(new TourDetailInfoResponse(label, value));
        }
    }

    private String getImage(String firstImage, String firstImage2) {
        if (firstImage != null && !firstImage.isBlank()) {
            return firstImage;
        }

        return firstImage2;
    }

    private String combineAddress(String addr1, String addr2) {
        return Stream.of(addr1, addr2)
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.joining(" "));
    }

    private Double parseDouble(String value) {
        try {
            return value == null || value.isBlank()
                    ? null
                    : Double.parseDouble(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private void validateContentType(Integer contentTypeId) {
        if (!List.of(12, 14, 15, 28, 32, 38, 39).contains(contentTypeId)) {
            throw new IllegalArgumentException("지원하지 않는 콘텐츠 유형입니다.");
        }
    }

    private String formatDateRange(String startDate, String endDate) {
        if (startDate == null || !startDate.matches("\\d{8}")) {
            return null;
        }

        String start = formatTourDate(startDate);

        if (endDate == null || !endDate.matches("\\d{8}")) {
            return start;
        }

        return start + " ~ " + formatTourDate(endDate);
    }

    private String formatTourDate(String value) {
        return value.substring(0, 4) + "."
                + value.substring(4, 6) + "."
                + value.substring(6, 8);
    }


}
