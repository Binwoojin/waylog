package kr.co.mycom.travel_korea.feed.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FeedProfileUpdateRequest (
        /*
         * @ 기호는 프론트에서 제거해도 되지만,
         * 백엔드에서도 한 번 더 정리합니다.
         */
        @NotBlank(message = "피드 아이디를 입력해주세요.")
        @Size(min = 3, max = 20, message = "피드 아이디는 3~20자로 입력해주세요.")
        String feedHandle
){
}
