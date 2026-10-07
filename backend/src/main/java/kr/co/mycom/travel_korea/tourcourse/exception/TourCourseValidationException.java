package kr.co.mycom.travel_korea.tourcourse.exception;

/**
 * 여행코스 구조 검증 실패 중 프론트가 구체적으로 분기해야 하는 경우에만 사용한다
 * (설계 §6 — REFERENCE/CUSTOM 필드 불일치 -> 400 INVALID_STOP_TYPE, ACCOUNT_SUSPENDED와
 * 같은 { code, message } 응답 관례). 그 외 검증 실패(제목 누락, 최소 일자/경유지 미달,
 * dayNumber/sortOrder 중복 등)는 기존 관례대로 IllegalArgumentException을 그대로 쓴다
 * (GlobalExceptionHandler가 { message }로 변환).
 */
public class TourCourseValidationException extends RuntimeException {

    private final String code;

    public TourCourseValidationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
