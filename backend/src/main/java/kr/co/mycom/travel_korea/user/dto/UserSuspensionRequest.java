package kr.co.mycom.travel_korea.user.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * 회원 활동 정지 요청 (admin-dashboard 설계 §3.2.2)
 *
 * days는 관리자가 그때 입력하는 값이다(고정 프리셋 아님).
 * 서버는 1~365 범위만 검증한다(UserSuspensionService와 동일 범위를 @Min/@Max로도 표현해 둔다).
 *
 * reason은 설계 §3.2.2 "사유 입력 필수"에 따라 @NotBlank로 검증한다
 * (FeedCreateRequest와 같은 스타일).
 */
public record UserSuspensionRequest(
        @Min(value = 1, message = "정지 기간은 1일 이상이어야 합니다.")
        @Max(value = 365, message = "정지 기간은 365일 이하여야 합니다.")
        int days,

        @NotBlank(message = "정지 사유를 입력해 주세요.")
        String reason
) {
}
