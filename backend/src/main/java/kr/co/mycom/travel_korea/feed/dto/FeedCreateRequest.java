package kr.co.mycom.travel_korea.feed.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public record FeedCreateRequest(

        @NotBlank(message = "게시글 내용을 입력해 주세요.")
        @Size(max = 2000, message = "게시글은 2000자 이내로 입력해 주세요.")
        String content,

        @Size(max = 150)
        String locationName,

        @Size(max = 255)
        String address,

        BigDecimal latitude,
        BigDecimal longitude,
        String tourContentId,
        Integer tourContentTypeId,

        /*
         * 여행코스 참조(tour-course-feed-linking 설계 §3.2/§4.1). 클라이언트는 이 둘만
         * 보낸다 — linkedCourseId와 스냅샷(코스명/일자 번호/경유지명)은 서버
         * (CourseLinkResolver)가 일자→코스 체인을 따라가 직접 채운다. 둘 다 없으면
         * "미태그", dayId만 있으면 "일자 단위", 둘 다 있으면 "경유지 단위"다. dayId 없이
         * stopId만 있는 조합은 서비스 계층에서 400으로 거부한다.
         */
        Long linkedCourseDayId,
        Long linkedCourseStopId,

        /*
         * PUBLIC, PRIVATE 중 하나를 전달합니다.
         * 값이 없으면 서비스에서 PUBLIC로 처리합니다.
         */
        String visibility,

        @Size(max = 10, message = "해시태그는 최대 10개까지 등록할 수 있습니다.")
        List<String> tags,

        /*
         * 우선 이미지 업로드가 완료된 URL을 전달받는 구조입니다.
         * Multipart 이미지 업로드 API는 이후 별도로 구현할 수 있습니다.
         */
        @Size(max = 5, message = "사진은 최대 5장까지 등록할 수 있습니다.")
        List<String> imageUrls
) {
}
