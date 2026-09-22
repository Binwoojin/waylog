package kr.co.mycom.travel_korea.tour.service;

import kr.co.mycom.travel_korea.tour.data.LocalClassificationCatalog;
import kr.co.mycom.travel_korea.tour.dto.response.TourClassificationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TourClassificationService {
    private final LocalClassificationCatalog catalog;
    /**
     * 검색 모달의 콘텐츠 유형에 맞는 중분류를 반환합니다.
     */
    public List<TourClassificationResponse> getClassifications(
            Integer contentTypeId
    ) {
        List<TourClassificationResponse> items =
                catalog.getAll();

        if (contentTypeId == null) {
            return distinctMiddleClassifications(items);
        }

        return switch (contentTypeId) {
            /*
             * 관광지는 자연·역사·체험·문화관광 분류를 사용합니다.
             */
            case 12 -> distinctMiddleClassifications(
                    items.stream()
                            .filter(item ->
                                    Set.of(
                                            "NA",
                                            "HS",
                                            "EX",
                                            "VE"
                                    ).contains(
                                            item.lclsSystm1Cd()
                                    )
                            )
                            .toList()
            );

            /*
             * 문화시설은 문화관광 중 공연·전시·행사·교육시설을
             * 우선 노출합니다.
             */
            case 14 -> distinctMiddleClassifications(
                    items.stream()
                            .filter(item ->
                                    Set.of(
                                            "VE06",
                                            "VE07",
                                            "VE08",
                                            "VE09"
                                    ).contains(
                                            item.lclsSystm2Cd()
                                    )
                            )
                            .toList()
            );

            // 여행코스
            case 25 -> distinctMiddleClassifications(
                    items.stream()
                            .filter(item ->
                                    "C01".equals(
                                            item.lclsSystm1Cd()
                                    )
                            )
                            .toList()
            );

            default -> List.of();
        };
    }

    /**
     * 같은 중분류가 여러 소분류에 반복되므로
     * lclsSystm2Cd 기준으로 한 번만 반환합니다.
     */
    private List<TourClassificationResponse>
    distinctMiddleClassifications(
            List<TourClassificationResponse> items
    ) {
        return items.stream()
                .collect(
                        java.util.stream.Collectors.toMap(
                                TourClassificationResponse
                                        ::lclsSystm2Cd,
                                item -> item,
                                (first, ignored) -> first,
                                java.util.LinkedHashMap::new
                        )
                )
                .values()
                .stream()
                .toList();
    }
}
