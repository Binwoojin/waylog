package kr.co.mycom.travel_korea.tourcourse.service;

import kr.co.mycom.travel_korea.board.dto.PageResponse;
import kr.co.mycom.travel_korea.board.storage.StorageService;
import kr.co.mycom.travel_korea.tourcourse.domain.TourCourse;
import kr.co.mycom.travel_korea.tourcourse.domain.TourCourseStop;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseAggregateProjection;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCoursePublicListItemResponse;
import kr.co.mycom.travel_korea.tourcourse.dto.TourCourseResponse;
import kr.co.mycom.travel_korea.tourcourse.repository.TourCourseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 비로그인 사용자를 위한 여행코스 읽기 전용 조회 서비스.
 *
 * Design Ref: tour-course-list-integration 설계 §2.2, §4.2.
 *
 * TourCourseAdminService(CRUD)와 물리적으로 분리한다 — 공개 컨트롤러가 이 서비스만
 * 의존하게 하면 쓰기 메서드(create/update/delete/이미지 첨부)를 실수로 호출할 경로
 * 자체가 생기지 않는다. 관리자 전용 코드(TourCourseAdminService, TourCourseAdminController,
 * TourCourseListItemResponse)는 이번 작업에서 전혀 수정하지 않는다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TourCoursePublicService {

    private final TourCourseRepository courseRepository;
    private final StorageService storageService;

    /**
     * 공개 코스 목록(키워드 검색 + 페이지네이션). 관리자 목록과 같은 search() 쿼리를
     * 재사용하되(days를 fetch하지 않으므로 여기서도 N+1 없음), 공개 카드에 필요한
     * 일자 수·경유지 수·1일차 대표 주소를 집계 쿼리 2개로 추가 조회한다(설계 §4.2,
     * 페이지당 총 쿼리 3개 — 검색 1 + 집계 2 — 로 고정, 페이지 안 행 수와 무관).
     */
    public PageResponse<TourCoursePublicListItemResponse> list(String keyword, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 50);

        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        Page<TourCourse> result = courseRepository.search(keyword, pageable);
        List<Long> ids = result.getContent().stream().map(TourCourse::getId).toList();

        Map<Long, TourCourseAggregateProjection> aggregates = ids.isEmpty()
                ? Map.of()
                : courseRepository.aggregateCounts(ids).stream()
                        .collect(Collectors.toMap(TourCourseAggregateProjection::courseId, aggregate -> aggregate));

        Map<Long, String> firstAddressByCourseId = new LinkedHashMap<>();
        if (!ids.isEmpty()) {
            for (TourCourseStop stop : courseRepository.findFirstDayStopsOrderedByCourse(ids)) {
                // sortOrder 오름차순으로 순회하므로 각 courseId에서 처음 만나는 행이 곧
                // 1일차의 첫 경유지다(putIfAbsent로 이후 값은 무시).
                firstAddressByCourseId.putIfAbsent(stop.getDay().getCourse().getId(), stop.getAddress());
            }
        }

        Page<TourCoursePublicListItemResponse> mapped = result.map(course -> {
            TourCourseAggregateProjection aggregate = aggregates.get(course.getId());
            return TourCoursePublicListItemResponse.from(
                    course,
                    aggregate == null ? 0 : aggregate.dayCount(),
                    aggregate == null ? 0 : aggregate.stopCount(),
                    firstAddressByCourseId.get(course.getId()),
                    this::toReadableUrl
            );
        });

        return PageResponse.from(mapped);
    }

    /**
     * 공개 코스 상세. 관리자 상세와 완전히 같은 응답 모양(TourCourseResponse)을 그대로
     * 쓴다 — DTO는 공유하되 서비스는 분리한다(설계 §2.2 "이유 있는 분리").
     */
    public TourCourseResponse getOne(Long id) {
        TourCourse course = courseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("여행코스를 찾을 수 없습니다."));
        return TourCourseResponse.from(course, this::toReadableUrl);
    }

    // TourCourseAdminService.toReadableUrl과 동일 로직(objectKey -> presigned URL).
    private String toReadableUrl(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return null;
        }

        if (objectKey.startsWith("http://") || objectKey.startsWith("https://")) {
            return objectKey;
        }

        return storageService.createReadUrl(objectKey);
    }
}
