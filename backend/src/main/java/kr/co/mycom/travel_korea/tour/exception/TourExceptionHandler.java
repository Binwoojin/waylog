package kr.co.mycom.travel_korea.tour.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;

/**
 * 관광 API 처리 중 발생한 예외를 일관된 JSON 형식으로 반환합니다.
 */
@RestControllerAdvice
public class TourExceptionHandler {

    /**
     * page, size, 지역 코드와 같은 잘못된 요청값을 처리합니다.
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(
            IllegalArgumentException exception
    ) {
        ErrorResponse response = new ErrorResponse(
                "INVALID_REQUEST",
                exception.getMessage(),
                LocalDateTime.now()
        );

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(response);
    }

    /**
     * 외부 TourAPI 통신 및 응답 오류를 처리합니다.
     */
    @ExceptionHandler(TourApiException.class)
    public ResponseEntity<ErrorResponse> handleTourApiException(
            TourApiException exception
    ) {
        ErrorResponse response = new ErrorResponse(
                exception.getErrorCode(),
                exception.getMessage(),
                LocalDateTime.now()
        );

        return ResponseEntity
                .status(HttpStatus.BAD_GATEWAY)
                .body(response);
    }

    /**
     * WayLog 관광 API의 공통 오류 응답 형식입니다.
     */
    public record ErrorResponse(
            String code,
            String message,
            LocalDateTime timestamp
    ) {
    }
}