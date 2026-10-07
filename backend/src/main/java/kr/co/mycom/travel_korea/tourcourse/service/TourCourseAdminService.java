package kr.co.mycom.travel_korea.tourcourse.service;

import kr.co.mycom.travel_korea.board.dto.PageResponse;
import kr.co.mycom.travel_korea.board.storage.StorageService;
import kr.co.mycom.travel_korea.board.storage.StoredObject;
import kr.co.mycom.travel_korea.tourcourse.domain.StopType;
import kr.co.mycom.travel_korea.tourcourse.domain.TourCourse;
import kr.co.mycom.travel_korea.tourcourse.domain.TourCourseDay;
import kr.co.mycom.travel_korea.tourcourse.domain.TourCourseStop;
import kr.co.mycom.travel_korea.tourcourse.domain.TourCourseStopImage;
import kr.co.mycom.travel_korea.tourcourse.domain.TourCourseStructureInput;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseDayRequest;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseListItemResponse;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseResponse;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseSaveRequest;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseStopRequest;
import kr.co.mycom.travel_korea.tourcourse.exception.TourCourseValidationException;
import kr.co.mycom.travel_korea.tourcourse.policy.TourCourseImagePolicy;
import kr.co.mycom.travel_korea.tourcourse.repository.TourCourseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * 관리자 여행코스 목록/상세/CRUD/이미지 첨부를 처리한다.
 *
 * Design Ref: admin-dashboard 설계 §3.3, §4.1, §6.
 *
 * 구조(코스/일자/경유지) 저장과 이미지 첨부는 2단계로 분리한다(설계 §3.3.4):
 * create/update는 구조만 다루고, 이미지는 별도 메서드(addStopImages/deleteStopImage/
 * replaceCoverImage)에서만 다룬다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TourCourseAdminService {

    private final TourCourseRepository courseRepository;
    private final StorageService storageService;

    public PageResponse<TourCourseListItemResponse> list(String keyword, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 50);

        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        Page<TourCourse> result = courseRepository.search(keyword, pageable);
        Page<TourCourseListItemResponse> mapped = result.map(course -> TourCourseListItemResponse.from(course, this::toReadableUrl));

        return PageResponse.from(mapped);
    }

    public TourCourseResponse getOne(Long id) {
        return TourCourseResponse.from(findCourse(id), this::toReadableUrl);
    }

    @Transactional
    public TourCourseResponse create(TourCourseSaveRequest request) {
        validateRequest(request);

        TourCourse course = new TourCourse(request.title().trim(), normalizeTheme(request.theme()));
        // 새 코스는 기존 일자가 없어 pruneUnreferenced가 할 일이 없으므로 applyStructure만 호출한다.
        course.applyStructure(request.title().trim(), normalizeTheme(request.theme()), toDayInputs(request.days()));

        TourCourse saved = courseRepository.save(course);
        return TourCourseResponse.from(saved, this::toReadableUrl);
    }

    @Transactional
    public TourCourseResponse update(Long id, TourCourseSaveRequest request) {
        validateRequest(request);

        TourCourse course = findCourse(id);
        List<TourCourseStructureInput.DayInput> dayInputs = toDayInputs(request.days());

        /*
         * 1단계: 요청에 없는 기존 일자/경유지를 먼저 제거하고 flush한다.
         * (course_id, day_number) 유니크 제약이 걸린 슬롯을 새 일자가 재사용할 수 있어,
         * 제거와 삽입을 같은 flush에서 처리하면 Hibernate가 삽입을 삭제보다 먼저 실행해
         * 일시적으로 제약을 위반할 수 있다(TourCourse.pruneUnreferenced 참고).
         */
        List<TourCourseStopImage> removedImages = course.pruneUnreferenced(dayInputs);
        List<String> keysToDelete = extractObjectKeys(removedImages);
        courseRepository.saveAndFlush(course);

        /*
         * 1.5단계: 살아남는 일자들에게 충돌 없는 임시 dayNumber를 부여하고 flush한다.
         * 두 일자의 순서를 맞바꾸는 요청(예: 1일차<->2일차)은 최종 값을 곧바로 적용하면
         * (course_id, day_number) 유니크 제약을 위반하므로(TourCourse.assignTemporaryDayNumbers
         * 참고), 여기서 먼저 임시값으로 비켜준다.
         */
        course.assignTemporaryDayNumbers();
        courseRepository.saveAndFlush(course);

        // 2단계: 코스명/테마와 유지되는 일자/경유지의 필드를 갱신하고, 새 일자/경유지를 추가한다.
        course.applyStructure(request.title().trim(), normalizeTheme(request.theme()), dayInputs);
        TourCourse saved = courseRepository.save(course);

        // DB 정리가 끝난 뒤 S3 객체를 정리한다(FeedService.delete와 같은 순서).
        keysToDelete.forEach(storageService::delete);

        return TourCourseResponse.from(saved, this::toReadableUrl);
    }

    @Transactional
    public void delete(Long id) {
        TourCourse course = findCourse(id);

        List<String> keysToDelete = new ArrayList<>();
        if (course.getCoverImageObjectKey() != null && !course.getCoverImageObjectKey().isBlank()) {
            keysToDelete.add(course.getCoverImageObjectKey());
        }
        course.getDays().forEach(day -> day.getStops().forEach(stop ->
                keysToDelete.addAll(extractObjectKeys(stop.getImages()))
        ));

        /*
         * TourCourse - TourCourseDay - TourCourseStop - TourCourseStopImage는
         * cascade = CascadeType.ALL, orphanRemoval = true로 연결돼 있어 이 한 번의
         * delete로 하위 DB 행이 모두 정리된다. S3 객체는 cascade가 모르므로
         * 위에서 미리 objectKey를 모아 뒀다가 아래에서 별도로 지운다.
         */
        courseRepository.delete(course);

        keysToDelete.forEach(storageService::delete);
    }

    @Transactional
    public TourCourseResponse addStopImages(Long courseId, Long stopId, List<MultipartFile> images) {
        /*
         * count-then-write 경쟁 조건 방지: 같은 코스에 동시에 여러 업로드 요청이 들어오면
         * 일자당 이미지 수 확인(countImagesInDay)과 실제 저장 사이에 다른 트랜잭션이 끼어들어
         * 합계가 10장을 넘을 수 있다. findByIdForUpdate로 코스 행에 PESSIMISTIC_WRITE 락을
         * 걸어, 같은 코스에 대한 동시 요청은 이 트랜잭션이 끝날 때까지 기다리게 한다.
         */
        TourCourse course = courseRepository.findByIdForUpdate(courseId)
                .orElseThrow(() -> new IllegalArgumentException("여행코스를 찾을 수 없습니다."));
        TourCourseStop stop = findStop(course, stopId);

        List<MultipartFile> safeImages = normalizeFiles(images);

        if (safeImages.isEmpty()) {
            throw new IllegalArgumentException("업로드할 이미지가 없습니다.");
        }

        TourCourseImagePolicy.validateFiles(safeImages);

        int existingDayImageCount = countImagesInDay(stop.getDay());
        TourCourseImagePolicy.ensureWithinDayLimit(existingDayImageCount, safeImages.size());

        List<String> uploadedKeys = new ArrayList<>();

        try {
            /*
             * images.size()가 아니라 max(sortOrder)+1을 쓴다 — 중간 이미지가 삭제된 뒤
             * 재업로드하면(예: 0,1,2 중 1을 삭제 -> size=2) size 기준으로는 다음 값도
             * 기존에 남아있는 2와 충돌한다.
             */
            int nextSortOrder = stop.getImages().stream()
                    .mapToInt(TourCourseStopImage::getSortOrder)
                    .max()
                    .orElse(-1) + 1;

            for (MultipartFile image : safeImages) {
                StoredObject stored = storageService.upload(image);
                uploadedKeys.add(stored.objectKey());
                stop.addImage(stored.objectKey(), nextSortOrder++);
            }

            TourCourse saved = courseRepository.save(course);
            return TourCourseResponse.from(saved, this::toReadableUrl);
        } catch (RuntimeException exception) {
            // 업로드 도중 오류가 나면 이번 요청에서 올라간 파일만 정리한다(FeedService.create와 동일한 패턴).
            uploadedKeys.forEach(key -> {
                try {
                    storageService.delete(key);
                } catch (RuntimeException ignored) {
                    // 원래 발생한 업로드 오류를 우선 반환
                }
            });
            throw exception;
        }
    }

    @Transactional
    public TourCourseResponse deleteStopImage(Long courseId, Long stopId, Long imageId) {
        TourCourse course = findCourse(courseId);
        TourCourseStop stop = findStop(course, stopId);

        TourCourseStopImage image = stop.getImages().stream()
                .filter(candidate -> candidate.getId().equals(imageId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("이미지를 찾을 수 없습니다."));

        String objectKey = image.getObjectKey();
        stop.removeImage(image);

        TourCourse saved = courseRepository.save(course);

        storageService.delete(objectKey);

        return TourCourseResponse.from(saved, this::toReadableUrl);
    }

    @Transactional
    public TourCourseResponse replaceCoverImage(Long courseId, MultipartFile image) {
        TourCourse course = findCourse(courseId);

        if (image == null || image.isEmpty()) {
            throw new IllegalArgumentException("대표 이미지 파일이 없습니다.");
        }

        TourCourseImagePolicy.validateFiles(List.of(image));

        String previousKey = course.getCoverImageObjectKey();
        StoredObject stored = storageService.upload(image);
        course.changeCoverImage(stored.objectKey());

        TourCourse saved = courseRepository.save(course);

        // 새 이미지 업로드/저장이 모두 끝난 뒤에만 이전 대표 이미지를 지운다(실패 시 기존 이미지 보존).
        if (previousKey != null && !previousKey.isBlank()) {
            storageService.delete(previousKey);
        }

        return TourCourseResponse.from(saved, this::toReadableUrl);
    }

    private TourCourse findCourse(Long id) {
        return courseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("여행코스를 찾을 수 없습니다."));
    }

    private TourCourseStop findStop(TourCourse course, Long stopId) {
        return course.getDays().stream()
                .flatMap(day -> day.getStops().stream())
                .filter(stop -> stop.getId().equals(stopId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("경유지를 찾을 수 없습니다."));
    }

    private int countImagesInDay(TourCourseDay day) {
        return day.getStops().stream()
                .mapToInt(stop -> stop.getImages().size())
                .sum();
    }

    private List<String> extractObjectKeys(List<TourCourseStopImage> images) {
        return images.stream()
                .map(TourCourseStopImage::getObjectKey)
                .filter(Objects::nonNull)
                .filter(key -> !key.isBlank())
                .toList();
    }

    private List<MultipartFile> normalizeFiles(List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            return List.of();
        }

        return files.stream()
                .filter(file -> file != null && !file.isEmpty())
                .toList();
    }

    /*
     * FeedService.toReadableImageUrl과 동일한 규칙(objectKey -> presigned URL)을 적용한다.
     */
    private String toReadableUrl(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return null;
        }

        if (objectKey.startsWith("http://") || objectKey.startsWith("https://")) {
            return objectKey;
        }

        return storageService.createReadUrl(objectKey);
    }

    /**
     * 생성·수정 공통 검증(설계 §3.3.3): 코스명 필수(@NotBlank로도 걸리지만 trim 이후
     * 공백만 남는 경우까지 방어), 최소 일자 1개(@NotEmpty), dayNumber는 1부터 연속
     * 정수이며 코스 내 유일, 일자당 최소 경유지 1개(@NotEmpty), 경유지 sortOrder는
     * 같은 일자 내 유일, REFERENCE/CUSTOM 필드 조합.
     */
    private void validateRequest(TourCourseSaveRequest request) {
        if (request.title() == null || request.title().isBlank()) {
            throw new IllegalArgumentException("코스명을 입력해 주세요.");
        }

        List<TourCourseDayRequest> days = request.days();
        if (days == null || days.isEmpty()) {
            throw new IllegalArgumentException("최소 하나 이상의 일자가 필요합니다.");
        }

        List<Integer> sortedDayNumbers = days.stream()
                .map(TourCourseDayRequest::dayNumber)
                .sorted()
                .toList();

        for (int index = 0; index < sortedDayNumbers.size(); index++) {
            if (sortedDayNumbers.get(index) != index + 1) {
                throw new IllegalArgumentException("일자 번호는 1부터 연속된 정수여야 하며 코스 내에서 중복될 수 없습니다.");
            }
        }

        for (TourCourseDayRequest day : days) {
            List<TourCourseStopRequest> stops = day.stops();

            if (stops == null || stops.isEmpty()) {
                throw new IllegalArgumentException(day.dayNumber() + "일차에는 최소 하나 이상의 경유지가 필요합니다.");
            }

            Set<Integer> sortOrders = new HashSet<>();

            for (TourCourseStopRequest stop : stops) {
                if (!sortOrders.add(stop.sortOrder())) {
                    throw new IllegalArgumentException(day.dayNumber() + "일차 안에서 경유지 순서(sortOrder)가 중복되었습니다.");
                }

                validateStop(stop);
            }
        }
    }

    /*
     * REFERENCE면 tourContentId+tourContentTypeId 필수, CUSTOM이면 없어야 한다
     * (설계 §3.3.2, §6 -> 400 INVALID_STOP_TYPE).
     */
    private void validateStop(TourCourseStopRequest stop) {
        if (stop.name() == null || stop.name().isBlank()) {
            throw new IllegalArgumentException("경유지 이름을 입력해 주세요.");
        }

        StopType type = stop.stopType();

        if (type == null) {
            throw new TourCourseValidationException("INVALID_STOP_TYPE", "경유지 타입(stopType)은 REFERENCE 또는 CUSTOM만 가능합니다.");
        }

        boolean hasReferenceFields = stop.tourContentId() != null && !stop.tourContentId().isBlank()
                && stop.tourContentTypeId() != null;

        if (type == StopType.REFERENCE && !hasReferenceFields) {
            throw new TourCourseValidationException("INVALID_STOP_TYPE", "REFERENCE 경유지는 tourContentId와 tourContentTypeId가 필요합니다.");
        }

        if (type == StopType.CUSTOM && (stop.tourContentId() != null || stop.tourContentTypeId() != null)) {
            throw new TourCourseValidationException("INVALID_STOP_TYPE", "CUSTOM 경유지는 tourContentId/tourContentTypeId를 가질 수 없습니다.");
        }
    }

    private String normalizeTheme(String theme) {
        if (theme == null || theme.isBlank()) {
            return null;
        }

        return theme.trim();
    }

    private List<TourCourseStructureInput.DayInput> toDayInputs(List<TourCourseDayRequest> days) {
        return days.stream()
                .map(day -> new TourCourseStructureInput.DayInput(
                        day.id(),
                        day.dayNumber(),
                        day.stops().stream()
                                .map(this::toStopInput)
                                .toList()
                ))
                .toList();
    }

    private TourCourseStructureInput.StopInput toStopInput(TourCourseStopRequest stop) {
        boolean isReference = stop.stopType() == StopType.REFERENCE;

        return new TourCourseStructureInput.StopInput(
                stop.id(),
                stop.sortOrder(),
                stop.stopType(),
                isReference ? stop.tourContentId() : null,
                isReference ? stop.tourContentTypeId() : null,
                stop.name().trim(),
                stop.address(),
                stop.latitude(),
                stop.longitude()
        );
    }
}
