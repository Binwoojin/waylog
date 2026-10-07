package kr.co.mycom.travel_korea.feed.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 관리자 피드 삭제 요청 (admin-dashboard 설계 §3.4.3)
 *
 * type은 "NORMAL"(소프트 삭제) 또는 "POLICY_VIOLATION"(하드 삭제)만 허용하며,
 * 값 검증은 서비스 레이어에서 IllegalArgumentException으로 처리한다
 * (GlobalExceptionHandler가 기존과 동일한 { "message": "..." } 400 응답으로 변환).
 *
 * reason은 UserSuspensionRequest와 같은 스타일로 @NotBlank 필수 입력이다.
 * suspendAuthor/suspensionDays는 POLICY_VIOLATION일 때만 의미가 있는 선택 필드다.
 */
public record FeedAdminDeleteRequest(
        @NotBlank(message = "삭제 유형을 선택해 주세요.")
        String type,

        @NotBlank(message = "삭제 사유를 입력해 주세요.")
        String reason,

        Boolean suspendAuthor,

        Integer suspensionDays
) {
}
