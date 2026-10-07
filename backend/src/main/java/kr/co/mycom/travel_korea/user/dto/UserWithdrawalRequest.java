package kr.co.mycom.travel_korea.user.dto;

import jakarta.validation.constraints.NotBlank;

/*
 * mypage-bookmarks 설계 §4.4(Q-1): 회원 탈퇴는 비밀번호 재확인을 요구한다.
 */
public record UserWithdrawalRequest(
        @NotBlank(message = "비밀번호를 입력해주세요.")
        String password
) {
}
