package kr.co.mycom.travel_korea.tour.service;

import kr.co.mycom.travel_korea.tour.dto.response.*;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 메인 페이지에 필요한 관광 데이터를 조합합니다.
 *
 * 첫 번째 목표 : 추천 여행지 3개만 반환
 */
@Service
@RequiredArgsConstructor
public class HomeTourService {
    private final TourService tourService;

    @Cacheable(
            cacheNames = "homeTours",
            key = "'home'",
            sync = true
    )
    public HomeTourResponse getHomeTours() {
        /*
         * 추천 여행지는 관광지 contentTypeId=12 중 3개를 조회합니다.
         */

        List<TourSummaryResponse> destinations = tourService.getTours(1,3,null,null,12,"Q").items();
        /*
         * 추천 여행코스 3개를 조회합니다.
         *
         * 각 코스는 기본 목록, 소개정보, 경유지 정보를 조합합니다.
         * 1 : 첫 번째 페이지
         * 3 : 데이터 3개
         * null : 전체 지역
         * null : 전체 시군구
         * 12 : 관광지
         * "Q" : 수정일순 정렬
         */
        List<TourCourseResponse> courses = tourService.getRecommendedCourses(3);

        /*
         * 축제를 한 번만 조회합니다.
         */
        List<TourSummaryResponse> festivalItems =
                tourService.getTours(
                        1, 5,
                        null, null,
                        15, "Q"
                ).items();

        /*
         * 축제, 레포츠, 음식점, 쇼핑, 숙박 유형에서
         * 대표 콘텐츠 한 개씩 조회합니다.
         */

        List<TourEnjoyResponse> enjoyItems = getEnjoyItems(festivalItems);

        List<TourFestivalResponse> festivals = getFestivals(festivalItems);

        return new HomeTourResponse(destinations, courses, enjoyItems, festivals);
    }

    /**
     * 메인 화면의 '여행을 더 즐겁게' 데이터를 조회합니다.
     *
     * 각 카테고리에서 5개씩 조회하므로
     * 총 최대 25개의 데이터를 반환합니다.
     *
     * 프론트엔드는 전체 필터에서 카테고리별 대표 1개씩 표시하고,
     * 특정 카테고리 필터에서는 해당 카테고리의 5개를 표시합니다.
     *
     * @return 축제, 레포츠, 음식점, 쇼핑, 숙박 데이터 목록
     */

    private List<TourEnjoyResponse> getEnjoyItems(List<TourSummaryResponse> festivalItems) {
        List<TourEnjoyResponse> result = new ArrayList<>();

        /*
         * TourAPI 콘텐츠 유형:
         *
         * 15 = 축제·행사
         * 28 = 레포츠
         * 39 = 음식점
         * 38 = 쇼핑
         * 32 = 숙박
         */

        addExistingEnjoyItems(
                result,
                festivalItems,
                "축제·행사"
        );

        addEnjoyItem(result, 28, "레포츠", 5);
        addEnjoyItem(result, 39, "음식점", 5);
        addEnjoyItem(result, 38, "쇼핑", 5);
        addEnjoyItem(result, 32, "숙박", 5);

        return result;
    }

    private void addExistingEnjoyItems(List<TourEnjoyResponse> result, List<TourSummaryResponse> items, String category) {
        result.addAll(
                items.stream()
                        .map(item -> new TourEnjoyResponse(
                                item.contentId(),
                                item.contentTypeId(),
                                category,
                                firstNonBlank(
                                        item.image(),
                                        item.thumbnail()
                                ),
                                item.title(),
                                item.address()
                        ))
                        .toList()
        );
    }

    /**
     * 특정 콘텐츠 유형의 데이터를 여러 건 조회한 뒤
     * 즐길거리 응답 목록에 추가합니다.
     *
     * @param result 조회 결과를 추가할 전체 목록
     * @param contentTypeId TourAPI 콘텐츠 유형
     * @param category 프론트 화면에 표시할 카테고리 이름
     * @param size 해당 카테고리에서 조회할 개수
     */

    private void addEnjoyItem(List<TourEnjoyResponse> result, int contentTypeId, String category, int size) {
        /*
         * 첫 번째 페이지에서 지정된 개수만큼 조회합니다.
         *
         * 지역 코드가 null이므로 전국을 대상으로 조회합니다.
         *
         * arrange=Q는 대표 이미지가 있는 콘텐츠를
         * 수정일 기준으로 조회하는 정렬 조건입니다.
         */
        TourListResponse response = tourService.getTours(1,size,null,null, contentTypeId, "Q");

        /*
         * 해당 콘텐츠 유형에 조회 결과가 없으면
         * 카드를 만들지 않고 메서드를 종료합니다.
         */

        if (response.items().isEmpty()) {
            return;
        }

        /*
         * 조회된 모든 TourSummaryResponse를
         * 메인 화면 전용 TourEnjoyResponse로 변환합니다.
         */
        List<TourEnjoyResponse> categoryItems =
                response.items()
                        .stream()
                        .map(item -> new TourEnjoyResponse(
                                item.contentId(),
                                item.contentTypeId(),
                                category,
                                /*
                                 * 기본 이미지가 없으면
                                 * 썸네일 이미지를 사용합니다.
                                 */
                                firstNonBlank(item.image(),item.thumbnail()),
                                item.title(),
                                item.address()
        )).toList();
        /*
         * 변환된 카테고리 목록을
         * 전체 즐길거리 목록에 추가합니다.
         */
        result.addAll(categoryItems);
    }

    /**
     * 메인 화면의 '이번 주 여행 소식'에 표시할
     * 축제·행사 데이터를 조회합니다.
     *
     * contentTypeId=15는 TourAPI의 축제·공연·행사 유형입니다.
     *
     * @return 메인 화면에 표시할 축제 목록
     */

    private List<TourFestivalResponse> getFestivals(List<TourSummaryResponse> festivalItems) {
        /*
         * getTours()의 반환 타입은 List가 아니라 TourListResponse입니다.
         *
         * 따라서 items()를 호출하여 실제 관광정보 목록인
         * List<TourSummaryResponse>를 꺼낸 뒤 stream()을 사용해야 합니다.
         */

        /* 이미 조회한 축제 5건을 재사용하여 TourAPI 중복 호출을 제거합니다. */
        return festivalItems
                .stream()
                .limit(3)
                /*
                 * TourSummaryResponse를 메인 화면 축제 전용
                 * TourFestivalResponse로 변환합니다.
                 */
                .map(tour -> new TourFestivalResponse(
                        tour.contentId(),
                        tour.title(),
                        /*
                         * 기본 이미지가 없으면 썸네일 이미지를 사용합니다.
                         */
                        firstNonBlank(tour.image(),tour.thumbnail()),
                        tour.address(),
                        /*
                         * 현재 목록 API에는 행사 시작일과 종료일이 없으므로
                         * 우선 null로 설정합니다.
                         *
                         * 이후 행사정보 API를 연동하면 실제 날짜로 교체합니다.
                         */
                        null,
                        null
                ))
                .toList();
    }

    /**
     * 첫 번째 이미지가 존재하면 사용하고,
     * 없으면 두 번째 이미지를 사용합니다.
     */
    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }

        if (second != null && !second.isBlank()) {
            return second;
        }

        return null;
    }
}
