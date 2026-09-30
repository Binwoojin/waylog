package kr.co.mycom.travel_korea.tourcourse.domain;

/**
 * 여행코스 경유지 등록 방식 (admin-dashboard 설계 §3.3.2, D-1 설계 제약).
 *
 * REFERENCE: TourAPI contentId+contentTypeId를 참조하고, name/address/좌표는
 *            관리자가 선택한 시점의 값을 스냅샷으로 저장한다(FeedPost와 동일한 패턴).
 * CUSTOM:    TourAPI에 없는 임의 장소를 이름/주소/좌표(숫자 입력)로 직접 등록한다.
 *            지도 API 연동 전까지는 좌표 선택 UI 없이 텍스트/숫자 입력만 지원한다.
 */
public enum StopType {
    REFERENCE,
    CUSTOM
}
