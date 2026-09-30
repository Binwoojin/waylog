package kr.co.mycom.travel_korea.tourcourse;

import kr.co.mycom.travel_korea.tourcourse.policy.TourCourseImagePolicy;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * admin-dashboard 설계 §3.3.3, §3.3.4-2 — 일자당 이미지 10장 제한과 개별 파일
 * 검증(용량·MIME)을 스토리지/스프링 컨텍스트 없이 순수 단위 테스트로 확인한다.
 * 실제 S3 업로드 경로(TourCourseAdminService.addStopImages)는 FeedAdminServiceTest와
 * 같은 이유로(§11 "새 의존성 금지", 실제 네트워크 호출 회피) 여기서 다루지 않는다.
 */
class TourCourseImagePolicyTest {

    @Test
    void withinLimitDoesNotThrow() {
        assertDoesNotThrow(() -> TourCourseImagePolicy.ensureWithinDayLimit(9, 1));
        assertDoesNotThrow(() -> TourCourseImagePolicy.ensureWithinDayLimit(0, 10));
    }

    @Test
    void exceedingLimitThrows() {
        assertThrows(IllegalArgumentException.class, () -> TourCourseImagePolicy.ensureWithinDayLimit(9, 2));
        assertThrows(IllegalArgumentException.class, () -> TourCourseImagePolicy.ensureWithinDayLimit(10, 1));
    }

    @Test
    void validateFilesAcceptsAllowedImage() {
        MultipartFile image = new MockMultipartFile("images", "photo.jpg", "image/jpeg", new byte[]{1, 2, 3});

        assertDoesNotThrow(() -> TourCourseImagePolicy.validateFiles(List.of(image)));
    }

    @Test
    void validateFilesRejectsDisallowedMimeType() {
        MultipartFile image = new MockMultipartFile("images", "photo.gif", "image/gif", new byte[]{1, 2, 3});

        assertThrows(IllegalArgumentException.class, () -> TourCourseImagePolicy.validateFiles(List.of(image)));
    }

    @Test
    void validateFilesRejectsOversizedImage() {
        byte[] oversized = new byte[(int) TourCourseImagePolicy.MAX_IMAGE_SIZE + 1];
        MultipartFile image = new MockMultipartFile("images", "photo.jpg", "image/jpeg", oversized);

        assertThrows(IllegalArgumentException.class, () -> TourCourseImagePolicy.validateFiles(List.of(image)));
    }

    @Test
    void validateFilesRejectsEmptyFile() {
        MultipartFile empty = new MockMultipartFile("images", "empty.jpg", "image/jpeg", new byte[0]);

        assertThrows(IllegalArgumentException.class, () -> TourCourseImagePolicy.validateFiles(List.of(empty)));
    }
}
