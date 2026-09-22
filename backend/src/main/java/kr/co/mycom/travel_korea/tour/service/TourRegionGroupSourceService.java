package kr.co.mycom.travel_korea.tour.service;

import kr.co.mycom.travel_korea.tour.client.TourApiClient;
import kr.co.mycom.travel_korea.tour.dto.external.TourApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/** 권역 페이지에서 사용할 시·도별 원본 목록을 캐시합니다. */
@Service
@RequiredArgsConstructor
public class TourRegionGroupSourceService {
    private static final int SOURCE_SIZE = 100;
    private final TourApiClient tourApiClient;

    @Cacheable(
            cacheNames = "tourLists",
            key = "'region-source:' + #lDongRegnCd + ':' + #contentTypeId + ':' + #arrange",
            sync = true
    )
    public TourApiResponse getRegionSource(
            Integer lDongRegnCd,
            Integer contentTypeId,
            String arrange
    ) {
        return tourApiClient.getAreaBasedList(
                1, SOURCE_SIZE, lDongRegnCd, null, contentTypeId, arrange
        );
    }
}
