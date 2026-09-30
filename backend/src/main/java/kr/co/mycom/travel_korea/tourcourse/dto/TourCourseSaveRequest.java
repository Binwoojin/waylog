package kr.co.mycom.travel_korea.tourcourse.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * 여행코스 구조 저장 요청 (생성/수정 공용, admin-dashboard 설계 §3.3.4-1,§4.1).
 *
 * 구조(코스/일자/경유지)만 JSON으로 받는다 — 이미지는 별도 멀티파트 엔드포인트로만
 * 첨부한다(설계 §3.3.4). 생성/수정 모두 이 DTO를 그대로 쓴다: 생성 시에는 days[].id,
 * stops[].id를 비워 두면 되고(서버가 무시하고 항상 새로 만든다), 수정 시에는 기존 id를
 * 그대로 돌려보내면 그 일자/경유지의 이미지가 보존된다.
 */
public record TourCourseSaveRequest(
        @NotBlank(message = "코스명을 입력해 주세요.")
        String title,

        String theme,

        @NotEmpty(message = "최소 하나 이상의 일자가 필요합니다.")
        @Valid
        List<TourCourseDayRequest> days
) {
}
