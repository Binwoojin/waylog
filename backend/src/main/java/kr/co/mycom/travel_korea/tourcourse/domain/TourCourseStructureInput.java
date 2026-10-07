package kr.co.mycom.travel_korea.tourcourse.domain;

import java.math.BigDecimal;
import java.util.List;

/**
 * 여행코스 구조 저장(생성/수정) 시 DTO -> 엔티티 변환 중간 표현.
 *
 * Design Ref: admin-dashboard 설계 §3.3.4-1 "구조만 JSON으로 저장".
 * 서비스 계층(TourCourseAdminService)이 요청 DTO(TourCourseSaveRequest 등)를 이 레코드로
 * 변환한 뒤 TourCourse.pruneUnreferenced()/applyStructure()에 넘긴다. 도메인 계층이 웹 DTO를 직접
 * 의존하지 않도록 분리한다.
 *
 * id가 있으면 기존 일자/경유지를 그대로 유지(이미지 보존)하고, 없으면 새로 만든다.
 * 요청에 다시 나타나지 않는 기존 id는 통째로 제거된다(설계 §4.1 "수정, 구조 전체 교체").
 */
public final class TourCourseStructureInput {

    private TourCourseStructureInput() {
    }

    public record DayInput(Long id, int dayNumber, List<StopInput> stops) {
    }

    public record StopInput(
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
}
