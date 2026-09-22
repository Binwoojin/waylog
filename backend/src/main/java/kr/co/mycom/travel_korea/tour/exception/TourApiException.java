package kr.co.mycom.travel_korea.tour.exception;

/**
 * TourAPI 호출 중 발생한 문제를 나타내는 예외입니다.
 *
 * 외부 통신 라이브러리에서 발생한 예외를 그대로 Service나
 * Controller에 전달하지 않고 WayLog 전용 예외로 변환합니다.
 */
public class TourApiException extends RuntimeException {
    /**
     * TourAPI 오류 코드 또는 WayLog에서 정의한 오류 코드입니다.
     */

    private final String errorCode;

    /**
     * TourAPI가 resultCode와 resultMsg를 반환한 경우 사용합니다.
     *
     * 사용 예:
     * throw new TourApiException(
     *     "EMPTY_RESPONSE",
     *     "TourAPI 응답이 비어 있습니다."
     * );
     *
     * @param errorCode 오류를 구분하는 코드
     * @param message 오류에 대한 설명
     */
    public TourApiException(String errorCode, String message) {
        /*
         * RuntimeException에 오류 메시지를 전달합니다.
         *
         * 이렇게 전달해야 exception.getMessage()로
         * 오류 메시지를 가져올 수 있습니다.
         */

        super(message);
        this.errorCode = errorCode;
    }


    /**
     * HTTP 연결 실패, 타임아웃, JSON 변환 실패 등에 사용합니다.
     *
     * @param message 사용자 또는 로그에 사용할 오류 설명
     * @param cause 실제 발생한 원인 예외
     */
    public TourApiException(String message, Throwable cause) {
        super(message, cause);
        this.errorCode = "TOUR_API_COMMUNICATION_ERROR";
    }

    public String getErrorCode() {
        return errorCode;
    }

}

/**
 * 발표 설명
 *
 * 외부 API 통신에서는 타임아웃, 서버 오류, 인증키 오류 등 다양한 예외가 발생할 수 있습니다.
 * 이를 TourApiException으로 통일해 Service가 HTTP 라이브러리의 세부 구현에 의존하지 않게 했습니다.
 */
