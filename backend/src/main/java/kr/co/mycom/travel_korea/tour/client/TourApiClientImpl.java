package kr.co.mycom.travel_korea.tour.client;

import kr.co.mycom.travel_korea.tour.config.TourApiProperties;
import kr.co.mycom.travel_korea.tour.dto.external.*;
import kr.co.mycom.travel_korea.tour.exception.TourApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.Comparator;
import java.util.List;

/**
 * 한국관광공사 TourAPI를 실제로 호출하는 Client 구현체입니다.
 *
 * TourService는 이 클래스의 구체적인 구현 내용을 알 필요 없이
 * TourApiClient 인터페이스만 사용합니다.
 */

@Slf4j
@RequiredArgsConstructor
@Component
@Profile("!local-mock") // 1번
public class TourApiClientImpl implements TourApiClient {

    private final RestClient tourApiRestClient;
    private final TourApiProperties properties;

    /**
     * 지역 기반 관광정보 목록을 조회합니다.
     *
     * 메인 화면에서는 다음 조건으로 호출됩니다.
     *
     * page = 1
     * size = 3
     * contentTypeId = 12
     * arrange = Q
     *
     * Q는 수정일순으로 정렬하면서 대표 이미지가 존재하는
     * 관광정보만 조회하는 정렬값입니다.
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
        return getAreaBasedList(
                page, size, lDongRegnCd, lDongSignguCd,
                contentTypeId, arrange, null, null
        );
    }

    @Override
    public TourApiResponse getAreaBasedList(
            int page,
            int size,
            Integer lDongRegnCd,
            Integer lDongSignguCd,
            Integer contentTypeId,
            String arrange,
            String lclsSystm1,
            String lclsSystm2
    ) {
        try {
            /*
             * RestClient를 이용해 areaBasedList2를 GET 방식으로 호출합니다.
             *
             * serviceKey, MobileOS, MobileApp, _type은 모든 TourAPI
             * 요청에 공통으로 필요한 값입니다.
             */
            TourApiRawResponse rawResponse = tourApiRestClient.get()
                    .uri(uriBuilder -> {
                        var builder = uriBuilder
                                .path("/areaBasedList2")
                                /*
                                 * 공공데이터포털에서 발급받은 현재 서비스키를
                                 * 별도로 encode/decode하지 않고 전달합니다.
                                 *
                                 * URI에 필요한 문자 인코딩은 RestClient와
                                 * UriBuilder가 처리합니다.
                                 */

                                .queryParam(
                                        "serviceKey",
                                        properties.serviceKey()
                                )
                                .queryParam(
                                        "MobileOS",
                                        properties.mobileOs()
                                )
                                .queryParam(
                                        "MobileApp",
                                        properties.mobileApp()
                                )
                                .queryParam("_type", "json")
                                .queryParam("pageNo", page)
                                .queryParam("numOfRows", size)
                                .queryParam("arrange", arrange);
                        /*
                         * 지역, 시군구, 콘텐츠 유형은 선택값입니다.
                         * 값이 있을 때만 요청 URL에 포함합니다.
                         */
                        if (lDongRegnCd != null) {
                            builder.queryParam("lDongRegnCd", lDongRegnCd);
                        }

                        if (lDongSignguCd != null) {
                            builder.queryParam("lDongSignguCd", lDongSignguCd);
                        }

                        if (contentTypeId != null) {
                            builder.queryParam("contentTypeId", contentTypeId);
                        }

                        if (lclsSystm1 != null && !lclsSystm1.isBlank()) {
                            builder.queryParam("lclsSystm1", lclsSystm1);
                        }

                        /*
                         * areaBasedList2는 lclsSystm2를 전달하면 오류 응답을
                         * 반환하므로 중분류는 서비스 계층에서 필터링합니다.
                         */

                        return builder.build();
                    })
                    .retrieve()
                    .body(TourApiRawResponse.class);
            /*
             * 외부 API 원본 응답을 WayLog 내부 응답으로 변환합니다.
             */
            return convertResponse(rawResponse);
        } catch (TourApiException exception) {
            /*
             * TourAPI가 HTTP 200으로 응답했지만
             * resultCode가 정상 코드가 아닌 경우입니다.
             */
            log.error(
                    "TourAPI 업무 오류가 발생했습니다. errorCode={}, message={}",
                    exception.getErrorCode(),
                    exception.getMessage()
            );
            throw exception;
        } catch (RestClientResponseException exception) {
            /*
             * TourAPI가 400, 401, 403, 429, 500 등의
             * HTTP 오류 상태를 반환한 경우입니다.
             *
             * 서비스키가 포함된 전체 요청 URL은
             * 보안상 로그에 출력하지 않습니다.
             */
            log.error(
                    "TourAPI HTTP 오류가 발생했습니다. " +
                            "status={}, responseBody={}",
                    exception.getStatusCode(),
                    exception.getResponseBodyAsString(),
                    exception
            );

            if (exception.getStatusCode().value() == 429) {
                throw new TourApiException(
                        "TOUR_API_RATE_LIMIT_EXCEEDED",
                        "TourAPI 일일 호출 한도를 초과했습니다."
                );
            }

            throw new TourApiException(
                    "TOUR_API_HTTP_ERROR",
                    "TourAPI가 HTTP 오류를 반환했습니다. " +
                            "status = " + exception.getStatusCode()
            );
        } catch (ResourceAccessException exception) {
            /*
             * 연결 실패, 연결 시간 초과 또는
             * 응답 대기 시간 초과인 경우입니다.
             */
            log.error(
                    "TourAPI 연결 또는 타임아웃 오류가 발생했습니다. message={}",
                    exception.getMessage(),
                    exception
            );

            throw new TourApiException(
                    "TOUR_API_TIMEOUT",
                    "TourAPI 연결 또는 응답 시간이 초과되었습니다."
            );


        } catch (RestClientException exception) {
            /*
             * 응답 JSON 변환 실패 등 나머지 RestClient 오류입니다.
             */
            log.error(
                    "TourAPI 응답 처리 중 오류가 발생했습니다. type={}, message={}",
                    exception.getClass().getName(),
                    exception.getMessage(),
                    exception
            );

            throw new TourApiException(
                    "TOUR_API_RESPONSE_ERROR",
                    "TourAPI 응답을 처리하지 못했습니다."
            );
        }
    }

    @Override
    public TourApiDetailCommonItem getDetailCommon(String contentId, Integer contentTypeId) {
        try {
            TourApiDetailCommonRawResponse rawResponse = tourApiRestClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/detailCommon2")
                            .queryParam("serviceKey", properties.serviceKey())
                            .queryParam("MobileOS", properties.mobileOs())
                            .queryParam("MobileApp", properties.mobileApp())
                            .queryParam("_type", "json")
                            .queryParam("contentId", contentId)
                            /*
                             * detailCommon2(최신 TourAPI 4.0)는 contentId만으로
                             * 공통 상세 정보를 조회합니다.
                             *
                             * contentTypeId와 defaultYN, firstImageYN 등의 예전
                             * 상세 옵션을 함께 보내면 일부 응답에서 본문이 비어
                             * 반환될 수 있으므로 이 API에서는 전달하지 않습니다.
                             */
                            .queryParam("pageNo", 1)
                            .queryParam("numOfRows", 1)
                            .build())
                    .retrieve()
                    .body(TourApiDetailCommonRawResponse.class);

            return extractDetailCommon(rawResponse);
        } catch (TourApiException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw convertCommunicationException("TourAPI 공통 상세", exception);
        }
    }

    @Override
    public TourApiDetailIntroItem getDetailIntro(String contentId, Integer contentTypeId) {
        try {
            TourApiDetailIntroRawResponse rawResponse = tourApiRestClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/detailIntro2")
                            .queryParam("serviceKey", properties.serviceKey())
                            .queryParam("MobileOS", properties.mobileOs())
                            .queryParam("MobileApp", properties.mobileApp())
                            .queryParam("_type", "json")
                            .queryParam("contentId", contentId)
                            .queryParam("contentTypeId", contentTypeId)
                            .build())
                    .retrieve()
                    .body(TourApiDetailIntroRawResponse.class);

            return extractDetailIntro(rawResponse);
        } catch (TourApiException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw convertCommunicationException("TourAPI 유형별 상세", exception);
        }
    }

    /** detailCommon2에서 상세 화면의 공통 정보를 꺼냅니다. */
    private TourApiDetailCommonItem extractDetailCommon(
            TourApiDetailCommonRawResponse rawResponse
    ) {
        if (rawResponse == null || rawResponse.response() == null) {
            throw new TourApiException(
                    "EMPTY_DETAIL_COMMON_RESPONSE",
                    "TourAPI 공통 상세 응답이 비어 있습니다."
            );
        }

        var response = rawResponse.response();
        var header = response.header();

        validateDetailResult(
                header == null ? null : header.resultCode(),
                header == null ? null : header.resultMsg()
        );

        if (response.body() == null
                || response.body().items() == null
                || response.body().items().item() == null
                || response.body().items().item().isEmpty()) {
            throw new TourApiException(
                    "EMPTY_DETAIL_COMMON_RESPONSE",
                    "TourAPI 공통 상세 데이터가 없습니다."
            );
        }

        return response.body().items().item().get(0);
    }

    /** detailIntro2에서 유형별 상세 정보를 꺼냅니다. */
    private TourApiDetailIntroItem extractDetailIntro(
            TourApiDetailIntroRawResponse rawResponse
    ) {
        if (rawResponse == null || rawResponse.response() == null) {
            return null;
        }

        var response = rawResponse.response();
        var header = response.header();

        validateDetailResult(
                header == null ? null : header.resultCode(),
                header == null ? null : header.resultMsg()
        );

        if (response.body() == null
                || response.body().items() == null
                || response.body().items().item() == null
                || response.body().items().item().isEmpty()) {
            // 유형별 상세 정보가 없는 콘텐츠도 공통 상세는 정상적으로 보여 줍니다.
            return null;
        }

        return response.body().items().item().get(0);
    }

    /** TourAPI detailCommon2·detailIntro2의 업무 결과 코드를 검사합니다. */
    private void validateDetailResult(String resultCode, String resultMessage) {
        if (resultCode == null) {
            throw new TourApiException(
                    "EMPTY_HEADER",
                    "TourAPI 상세 응답 헤더가 없습니다."
            );
        }

        if (!"0000".equals(resultCode)) {
            throw new TourApiException(resultCode, resultMessage);
        }
    }

    @Override
    public List<TourApiRegionItem> getRegionCodes(Integer lDongRegnCd) {
        try {
            TourApiRegionRawResponse rawResponse = tourApiRestClient.get()
                    .uri(uriBuilder -> {
                        var builder = uriBuilder.path("/ldongCode2")
                                .queryParam("serviceKey", properties.serviceKey())
                                .queryParam("MobileOS", properties.mobileOs())
                                .queryParam("MobileApp", properties.mobileApp())
                                .queryParam("_type", "json")
                                .queryParam("pageNo", 1)
                                .queryParam("numOfRows", 100);
                        if (lDongRegnCd != null) {
                            builder.queryParam("lDongRegnCd", lDongRegnCd);
                        }
                        return builder.build();
                    })
                    .retrieve()
                    .body(TourApiRegionRawResponse.class);

            if (rawResponse == null || rawResponse.response() == null) {
                throw new TourApiException("EMPTY_REGION_RESPONSE", "지역 코드 응답이 비어 있습니다.");
            }
            var response = rawResponse.response();
            validateCourseResult(
                    response.header() == null ? null : response.header().resultCode(),
                    response.header() == null ? null : response.header().resultMsg()
            );
            if (response.body() == null || response.body().items() == null ||
                    response.body().items().item() == null) {
                return List.of();
            }
            return response.body().items().item();
        } catch (TourApiException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw convertCommunicationException("지역 코드", exception);
        }
    }

    @Override
    public TourApiFestivalResponse getFestivals(
            int page,
            int size,
            Integer lDongRegnCd,
            Integer lDongSignguCd,
            String eventStartDate,
            String eventEndDate,
            String arrange
    ) {
        try {
            TourApiFestivalRawResponse rawResponse = tourApiRestClient.get()
                    .uri(uriBuilder -> {
                        var builder = uriBuilder.path("/searchFestival2")
                                .queryParam("serviceKey", properties.serviceKey())
                                .queryParam("MobileOS", properties.mobileOs())
                                .queryParam("MobileApp", properties.mobileApp())
                                .queryParam("_type", "json")
                                .queryParam("pageNo", page)
                                .queryParam("numOfRows", size)
                                .queryParam("arrange", arrange)
                                .queryParam("eventStartDate", eventStartDate)
                                .queryParam("eventEndDate", eventEndDate);
                        if (lDongRegnCd != null) {
                            builder.queryParam("lDongRegnCd", lDongRegnCd);
                        }
                        if (lDongSignguCd != null) {
                            builder.queryParam("lDongSignguCd", lDongSignguCd);
                        }
                        return builder.build();
                    })
                    .retrieve()
                    .body(TourApiFestivalRawResponse.class);

            if (rawResponse == null || rawResponse.response() == null) {
                throw new TourApiException("EMPTY_FESTIVAL_RESPONSE", "축제 응답이 비어 있습니다.");
            }
            var response = rawResponse.response();
            validateCourseResult(
                    response.header() == null ? null : response.header().resultCode(),
                    response.header() == null ? null : response.header().resultMsg()
            );
            if (response.body() == null) {
                return new TourApiFestivalResponse(List.of(), page, size, 0);
            }
            var body = response.body();
            var items = body.items() == null || body.items().item() == null
                    ? List.<TourApiFestivalItem>of()
                    : body.items().item();
            return new TourApiFestivalResponse(items, body.pageNo(), body.numOfRows(), body.totalCount());
        } catch (TourApiException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw convertCommunicationException("축제", exception);
        }
    }

    @Override
    public TourApiCourseIntroItem getCourseIntro(String contentId) {
        try {
            TourApiCourseIntroRawResponse rawResponse =
                    tourApiRestClient.get()
                            .uri(uriBuilder -> uriBuilder
                                    .path("/detailIntro2")
                                    .queryParam(
                                            "serviceKey",
                                            properties.serviceKey()
                                    )
                                    .queryParam(
                                            "MobileOS",
                                            properties.mobileOs()
                                    )
                                    .queryParam(
                                            "MobileApp",
                                            properties.mobileApp()
                                    )
                                    .queryParam("_type", "json")
                                    .queryParam("pageNo", 1)
                                    .queryParam("numOfRows", 10)
                                    .queryParam("contentId", contentId)
                                    .queryParam("contentTypeId", 25)
                                    .build()
                            )
                            .retrieve()
                            .body(
                                    TourApiCourseIntroRawResponse.class
                            );
            return extractCourseIntro(rawResponse);
        } catch (TourApiException exception) {
            throw exception;

        } catch (RestClientException exception) {
            throw new TourApiException(
                    "여행코스 소개정보 조회에 실패했습니다.",
                    exception
            );
        }
    }


    /**
     * detailIntro2 원본 응답에서 첫 번째 코스 소개정보를 꺼냅니다.
     */

    /**
     * detailIntro2 원본 응답에서 첫 번째 코스 소개정보를 꺼냅니다.
     */
    private TourApiCourseIntroItem extractCourseIntro(
            TourApiCourseIntroRawResponse rawResponse
    ) {
        if (rawResponse == null ||
                rawResponse.response() == null) {
            throw new TourApiException(
                    "EMPTY_COURSE_INTRO_RESPONSE",
                    "여행코스 소개정보 응답이 비어 있습니다."
            );
        }

        var response = rawResponse.response();
        var header = response.header();

        validateCourseResult(
                header == null ? null : header.resultCode(),
                header == null ? null : header.resultMsg()
        );

        if (response.body() == null ||
                response.body().items() == null ||
                response.body().items().item() == null ||
                response.body().items().item().isEmpty()) {
            return null;
        }

        return response.body()
                .items()
                .item()
                .get(0);
    }

    @Override
    public List<TourApiCourseDetailItem> getCourseDetails(String contentId) {
        try {
            TourApiCourseDetailRawResponse rawResponse =
                    tourApiRestClient.get()
                            .uri(uriBuilder -> uriBuilder
                                    .path("/detailInfo2")
                                    .queryParam(
                                            "serviceKey",
                                            properties.serviceKey()
                                    )
                                    .queryParam(
                                            "MobileOS",
                                            properties.mobileOs()
                                    )
                                    .queryParam(
                                            "MobileApp",
                                            properties.mobileApp()
                                    )
                                    .queryParam("_type", "json")
                                    .queryParam("pageNo", 1)
                                    .queryParam("numOfRows", 20)
                                    .queryParam("contentId", contentId)
                                    .queryParam("contentTypeId", 25)
                                    .build()
                            )
                            .retrieve()
                            .body(
                                    TourApiCourseDetailRawResponse.class
                            );

            return extractCourseDetails(rawResponse);

        } catch (TourApiException exception) {
            throw exception;

        } catch (RestClientException exception) {
            throw new TourApiException(
                    "여행코스 경유지 조회에 실패했습니다.",
                    exception
            );
        }
    }



    /**
     * detailInfo2 응답에서 경유지 목록을 꺼내고
     * subnum 순서대로 정렬합니다.
     */
    private List<TourApiCourseDetailItem> extractCourseDetails(
            TourApiCourseDetailRawResponse rawResponse
    ) {
        if (rawResponse == null ||
                rawResponse.response() == null) {
            throw new TourApiException(
                    "EMPTY_COURSE_DETAIL_RESPONSE",
                    "여행코스 경유지 응답이 비어 있습니다."
            );
        }

        var response = rawResponse.response();
        var header = response.header();

        validateCourseResult(
                header == null ? null : header.resultCode(),
                header == null ? null : header.resultMsg()
        );

        if (response.body() == null ||
                response.body().items() == null ||
                response.body().items().item() == null) {
            return List.of();
        }
        Comparator<TourApiCourseDetailItem> courseOrder =
                Comparator.comparing(
                        (TourApiCourseDetailItem item) ->
                                item.subnum(),
                        Comparator.nullsLast(Integer::compareTo)
                );

        return response.body()
                .items().item().stream().sorted(courseOrder).toList();
    }

    /**
     * TourAPI 원본 응답을 WayLog 내부에서 사용하는 단순 응답으로 변환합니다.
     */
    private TourApiResponse convertResponse(TourApiRawResponse rawResponse) {
        /*
         * 응답 자체 또는 response 필드가 없으면
         * 정상적인 TourAPI 응답으로 볼 수 없습니다.
         */
        if (rawResponse == null || rawResponse.response() == null) {
            throw new TourApiException("EMPTY_RESPONSE", "TourAPI 응답이 비어 있습니다.");
        }

        TourApiRawResponse.Response response = rawResponse.response();
        TourApiRawResponse.Header header = response.header();

        /*
         * TourAPI 정상 결과 코드는 "0000"입니다.
         *
         * HTTP 상태가 200이어도 resultCode가 오류일 수 있기 때문에
         * 반드시 header의 결과 코드도 확인해야 합니다.
         */

        if (header == null) {
            throw new TourApiException("EMPTY_HEADER", "TourAPI 응답 헤더가 없습니다.");
        }

        if (!"0000".equals(header.resultCode())) {
            throw new TourApiException(header.resultCode(), header.resultMsg());
        }

        TourApiRawResponse.Body body = response.body();

        /*
         * 정상 코드지만 body가 없는 경우에는 빈 목록으로 처리합니다.
         */

        if (body == null) {
            return new TourApiResponse(List.of(), 1, 0, 0);
        }

        /*
         * 검색 결과가 없으면 items 또는 item이 null일 수 있습니다.
         *
         * 결과가 없는 것은 오류가 아니므로 빈 List로 변환합니다.
         */
        List<TourApiItem> items =
                body.items() == null || body.items().item() == null
                ? List.of() : body.items().item();

        return new TourApiResponse(items, body.pageNo(), body.numOfRows(), body.totalCount());
    }
    /**
     * 코스 상세 API의 TourAPI 결과 코드를 검사합니다.
     */
    private void validateCourseResult(
            String resultCode,
            String resultMessage
    ) {
        if (resultCode == null) {
            throw new TourApiException(
                    "EMPTY_HEADER",
                    "TourAPI 응답 헤더가 없습니다."
            );
        }

        if (!"0000".equals(resultCode)) {
            throw new TourApiException(
                    resultCode,
                    resultMessage
            );
        }
    }

    /** 신규 API도 목록 API와 동일하게 429를 구분해 전달합니다. */
    private TourApiException convertCommunicationException(
            String target,
            RestClientException exception
    ) {
        if (exception instanceof RestClientResponseException responseException &&
                responseException.getStatusCode().value() == 429) {
            return new TourApiException(
                    "TOUR_API_RATE_LIMIT_EXCEEDED",
                    "TourAPI 일일 호출 한도를 초과했습니다."
            );
        }
        return new TourApiException(target + " 정보 조회에 실패했습니다.", exception);
    }

}

/**
 * 1번 발표 설명
 *
 * 개발 초기에는 외부 API 없이 화면을 만들 수 있도록 Mock 구현체를 사용했고,
 * 실제 실행에서는 TourApiClientImpl을 사용하도록 Spring Profile로 분리했습니다.
 *
 *
 * TourApiClientImpl에서는 TourAPI의 업무 오류와 HTTP 통신 오류를 구분했습니다.
 * TourAPI가 resultCode와 resultMsg를 반환한 경우에는 오류 코드와 메시지를 보존하고,
 * 타임아웃이나 JSON 변환 실패처럼 HTTP 통신 중 발생한 문제는 공통 통신 오류 코드로 변환했습니다.
 */
