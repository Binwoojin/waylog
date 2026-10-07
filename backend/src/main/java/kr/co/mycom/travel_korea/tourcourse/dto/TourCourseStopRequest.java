package kr.co.mycom.travel_korea.tourcourse.dto;

import kr.co.mycom.travel_korea.tourcourse.domain.StopType;

import java.math.BigDecimal;

/**
 * 여행코스 경유지 저장 요청 (admin-dashboard 설계 §3.3.2, §3.3.3).
 *
 * id가 있으면 기존 경유지를 유지(이미지 보존), 없으면 새 경유지로 취급한다(설계 §4.1).
 * REFERENCE/CUSTOM에 따른 tourContentId/tourContentTypeId 필수/금지 검증과
 * sortOrder 중복 검증은 서비스 레이어(TourCourseAdminService)에서 처리한다 —
 * 이 두 규칙은 필드 하나만으로 판단할 수 없는 교차 검증이라 Bean Validation
 * 어노테이션만으로는 표현하기 어렵다.
 */
public record TourCourseStopRequest(
        Long id,
        int sortOrder,
        StopType stopType,
        String tourContentId,
        Integer tourContentTypeId,
        String name,
        String address,
        BigDecimal latitude,
        BigDecimal longitude
) {
}
