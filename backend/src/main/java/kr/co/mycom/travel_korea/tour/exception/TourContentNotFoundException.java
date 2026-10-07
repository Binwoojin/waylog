package kr.co.mycom.travel_korea.tour.exception;

/**
 * 요청한 관광 콘텐츠가 TourAPI에 존재하지 않을 때 발생하는 예외입니다.
 *
 * TourAPI가 정상 결과 코드(0000)와 함께 빈 items를 반환한 경우처럼
 * 외부 API 장애가 아니라 "데이터 없음"인 상황을 TourApiException(502)과 구분합니다.
 * TourExceptionHandler가 이 예외를 404로 변환하므로 프론트는 상태 코드만으로
 * not-found 화면과 오류 화면을 나눌 수 있습니다.
 */
public class TourContentNotFoundException extends RuntimeException {

    private final String contentId;

    public TourContentNotFoundException(String contentId) {
        super("요청한 관광 콘텐츠를 찾을 수 없습니다.");
        this.contentId = contentId;
    }

    public String getContentId() {
        return contentId;
    }
}
