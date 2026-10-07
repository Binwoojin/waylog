package kr.co.mycom.travel_korea.feed.exception;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/*
 * feed-integration 설계 문서 §1.3 (P-9): 이 클래스에 있던 handleValidation
 * (MethodArgumentNotValidException)은 @ExceptionHandler 애너테이션이 빠져
 * 스프링이 호출한 적이 없는 죽은 메서드였다. 이미 common.exception.GlobalExceptionHandler가
 * 같은 예외를 동일한 {message} 형식으로 정상 처리하고 있어 실제 동작에는 영향이 없었다.
 * 애너테이션을 추가하지 않고 죽은 메서드를 삭제했다 — 두 전역 @RestControllerAdvice가
 * 동시에 같은 예외를 처리하면 어느 빈이 우선하는지 스프링의 내부 정렬 순서에 암묵적으로
 * 의존하게 되어 유지보수 시 예측하기 어려워지기 때문이다.
 *
 * handleBadRequest(IllegalArgumentException)은 GlobalExceptionHandler.handleIllegalArgument와
 * 내용이 중복되지만, 오래 전부터 정상 동작 중이던 기존 코드이고 이번 기능과 직접 관련이
 * 없으므로 최소 변경 원칙에 따라 함께 손대지 않는다.
 */
@RestControllerAdvice
public class FeedExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
    }
}
