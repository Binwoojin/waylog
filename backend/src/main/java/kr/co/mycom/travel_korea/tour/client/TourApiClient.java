package kr.co.mycom.travel_korea.tour.client;

import kr.co.mycom.travel_korea.tour.dto.external.*;

import java.util.List;

/**
 * WayLog 서비스 계층과 외부 TourAPI 호출 계층 사이의 인터페이스입니다.
 *
 * 현재는 목록 조회만 정의합니다. 검색과 상세 조회는 목록 기능이
 * 정상적으로 동작한 뒤 메서드를 추가합니다.
 *
 * 팀원 A는 이 인터페이스를 구현한 실제 TourAPI Client를 작성합니다.
 */



public interface TourApiClient {
    /**
     * 지역 및 콘텐츠 유형을 기준으로 관광정보 목록을 조회합니다.
     *
     * @param page 페이지 번호
     * @param size 페이지당 결과 개수
     * @param lDongRegnCd 지역 코드
     * @param lDongSignguCd 시군구 코드
     * @param contentTypeId 콘텐츠 유형 코드
     * @param arrange 정렬 기준
     * @return TourAPI 목록 조회 결과
     */

    TourApiResponse getAreaBasedList(
            int page,
            int size,
            Integer lDongRegnCd,
            Integer lDongSignguCd,
            Integer contentTypeId,
            String arrange
    );

    /**
     * 여행코스 소개정보를 조회합니다.
     *
     * @param contentId 여행코스 콘텐츠 ID
     * @return 코스 소요시간, 일정, 테마
     */
    TourApiCourseIntroItem getCourseIntro(
            String contentId
    );

    /**
     * 여행코스의 경유지 목록을 조회합니다.
     *
     * @param contentId 여행코스 콘텐츠 ID
     * @return 순서가 적용된 경유지 목록
     */
    List<TourApiCourseDetailItem> getCourseDetails(
            String contentId
    );

    List<TourApiRegionItem> getRegionCodes(Integer lDongRegnCd);

    TourApiFestivalResponse getFestivals(
            int page,
            int size,
            Integer lDongRegnCd,
            Integer lDongSignguCd,
            String eventStartDate,
            String eventEndDate,
            String arrange
    );

    /**
     * 지역·콘텐츠 유형과 분류체계를 함께 적용해 관광정보를 조회합니다.
     * 기존 테스트 클라이언트는 기본 구현을 사용하고, 실제 클라이언트는
     * 이 메서드를 재정의하여 TourAPI에 분류 코드를 전달합니다.
     */
    default TourApiResponse getAreaBasedList(
            int page,
            int size,
            Integer lDongRegnCd,
            Integer lDongSignguCd,
            Integer contentTypeId,
            String arrange,
            String lclsSystm1,
            String lclsSystm2
    ) {
        return getAreaBasedList(
                page, size, lDongRegnCd, lDongSignguCd, contentTypeId, arrange
        );
    }

    /**
     * TourAPI 공통 상세 정보를 조회합니다.
     * 제목, 이미지, 주소, 좌표, 소개 문구를 가져옵니다.
     */
    TourApiDetailCommonItem getDetailCommon(String contentId, Integer contentTypeId);

    /**
     * TourAPI 유형별 상세 정보를 조회합니다.
     * contentTypeId에 따라 관광지·축제·음식점 등의 필드가 달라집니다.
     */
    TourApiDetailIntroItem getDetailIntro(String contentId, Integer contentTypeId);
}
