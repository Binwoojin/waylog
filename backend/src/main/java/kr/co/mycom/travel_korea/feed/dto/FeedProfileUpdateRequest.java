package kr.co.mycom.travel_korea.feed.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/*
 * mypage-bookmarks 설계 §3.2: 기존 feedHandle 단일 필드를 nickname/introduce/feedHandle
 * 3필드로 확장한다(Q-2). 닉네임 길이 제약(2~30자)은 SignupPage.jsx의 기존 프론트 검증과
 * UserEntity.NICKNAME 컬럼 길이(30자)를 그대로 따른 것이다.
 */
public record FeedProfileUpdateRequest (
        @NotBlank(message = "닉네임을 입력해주세요.")
        @Size(min = 2, max = 30, message = "닉네임은 2~30자로 입력해주세요.")
        String nickname,

        @Size(max = 200, message = "소개는 200자 이내로 입력해주세요.")
        String introduce,

        /*
         * @ 기호는 프론트에서 제거해도 되지만,
         * 백엔드에서도 한 번 더 정리합니다.
         */
        @NotBlank(message = "피드 아이디를 입력해주세요.")
        @Size(min = 3, max = 20, message = "피드 아이디는 3~20자로 입력해주세요.")
        String feedHandle
){
}
