package kr.co.mycom.travel_korea.tourcourse.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * 여행코스 일자 저장 요청 (admin-dashboard 설계 §3.3.1, §3.3.3).
 *
 * id가 있으면 기존 일자를 유지, 없으면 새 일자로 취급한다(설계 §4.1 "구조 전체 교체").
 * dayNumber가 1부터 연속 정수인지, 코스 내에서 유일한지는 서비스 레이어에서 검증한다
 * (여러 일자를 한 번에 봐야 판단 가능한 교차 검증).
 */
public record TourCourseDayRequest(
        Long id,
        int dayNumber,

        @NotEmpty(message = "일자당 최소 하나 이상의 경유지가 필요합니다.")
        @Valid
        List<TourCourseStopRequest> stops
) {
}
