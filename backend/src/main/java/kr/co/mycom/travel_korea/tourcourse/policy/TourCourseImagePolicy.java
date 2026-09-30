package kr.co.mycom.travel_korea.tourcourse.policy;

import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Set;

/**
 * 여행코스 경유지/대표 이미지 업로드 정책.
 *
 * Design Ref: admin-dashboard 설계 §3.3.4-2 — 파일 검증(개수·용량·MIME)은
 * FeedService의 상수(MAX_IMAGE_SIZE 5MB, ALLOWED_IMAGE_TYPES jpeg/png/webp,
 * FeedService.java:40-50)와 같은 값을 이 전용 정책 클래스에 둔다.
 * 코스만의 규칙(일자당 이미지 10장 제한, 설계 §3.3.3)도 함께 관리한다.
 */
public final class TourCourseImagePolicy {

    private TourCourseImagePolicy() {
    }

    /** 같은 일자(day)에 속한 모든 경유지 이미지 수의 합 상한 (설계 §3.3.3). */
    public static final int MAX_IMAGES_PER_DAY = 10;

    /** FeedService.MAX_IMAGE_SIZE와 동일한 값(5MB). */
    public static final long MAX_IMAGE_SIZE = 5 * 1024 * 1024;

    /** FeedService.ALLOWED_IMAGE_TYPES와 동일한 값. */
    public static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp"
    );

    /**
     * 일자당 이미지 수 상한 검사(설계 §3.3.3, §3.3.4-2). 이 일자에 속한 모든 경유지의
     * 기존 이미지 수 + 새로 올릴 파일 수의 합이 10을 넘으면 저장 전에 400으로 막는다.
     */
    public static void ensureWithinDayLimit(int existingCount, int newCount) {
        if (existingCount + newCount > MAX_IMAGES_PER_DAY) {
            throw new IllegalArgumentException(
                    "같은 일자에는 이미지를 최대 " + MAX_IMAGES_PER_DAY + "장까지 등록할 수 있습니다. (현재 "
                            + existingCount + "장, 추가 요청 " + newCount + "장)"
            );
        }
    }

    /**
     * 개별 파일의 빈 파일 여부, 용량, MIME 타입을 검사한다(FeedService.validateImages와
     * 동일한 규칙). S3 업로드 전에 호출해 잘못된 파일을 400으로 차단한다.
     */
    public static void validateFiles(List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            return;
        }

        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                throw new IllegalArgumentException("빈 이미지는 업로드할 수 없습니다.");
            }

            if (file.getSize() > MAX_IMAGE_SIZE) {
                throw new IllegalArgumentException("이미지 한 장은 5MB 이하만 업로드할 수 있습니다.");
            }

            String contentType = file.getContentType();

            if (contentType == null || !ALLOWED_IMAGE_TYPES.contains(contentType)) {
                throw new IllegalArgumentException("JPG, PNG, WebP 형식의 이미지만 업로드할 수 있습니다.");
            }
        }
    }
}
