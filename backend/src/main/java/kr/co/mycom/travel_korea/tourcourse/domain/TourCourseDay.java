package kr.co.mycom.travel_korea.tourcourse.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 여행코스의 일자(Day). "(course_id, day_number)" 유니크 제약으로 코스 내 유일함을
 * DB 레벨에서도 보장한다(서비스 레벨 검증은 TourCourseAdminService가 담당).
 *
 * Design Ref: admin-dashboard 설계 §3.3.1.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "tour_course_day",
        uniqueConstraints = @UniqueConstraint(name = "uk_tour_course_day_number", columnNames = {"course_id", "day_number"}))
public class TourCourseDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tour_course_day_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private TourCourse course;

    @Column(name = "day_number", nullable = false)
    private int dayNumber;

    @OneToMany(mappedBy = "day", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<TourCourseStop> stops = new ArrayList<>();

    TourCourseDay(TourCourse course, int dayNumber) {
        this.course = course;
        this.dayNumber = dayNumber;
    }

    void changeDayNumber(int dayNumber) {
        this.dayNumber = dayNumber;
    }

    /**
     * 구조 교체 1단계: 요청에 다시 나타나지 않는 기존 경유지를 먼저 제거한다.
     * TourCourse.pruneUnreferenced()와 같은 이유(삭제/삽입 flush 순서 충돌 회피)로
     * applyStops()보다 먼저 호출·flush돼야 한다. 경유지 sortOrder에는 DB 유니크 제약이
     * 없어(설계상 서비스 레벨 검증만) 실제로는 stop 재정렬 자체는 충돌 위험이 없지만,
     * 이 메서드는 코스 전체 프루닝(TourCourse.pruneUnreferenced)과 같은 패스에서
     * 함께 호출되도록 구조를 맞춘 것이다.
     */
    List<TourCourseStopImage> pruneUnreferencedStops(List<TourCourseStructureInput.StopInput> stopInputs) {
        Set<Long> keepStopIds = new HashSet<>();
        for (TourCourseStructureInput.StopInput stopInput : stopInputs) {
            if (stopInput.id() != null) {
                keepStopIds.add(stopInput.id());
            }
        }

        List<TourCourseStopImage> removedImages = new ArrayList<>();

        stops.removeIf(stop -> {
            if (stop.getId() != null && !keepStopIds.contains(stop.getId())) {
                removedImages.addAll(stop.getImages());
                return true;
            }
            return false;
        });

        return removedImages;
    }

    /**
     * 구조 교체 2단계: 유지되는 경유지는 필드만 최신 요청 값으로 갱신하고, 요청에만
     * 있는 새 경유지를 추가한다. 이미지 목록은 건드리지 않는다 — 이미지는 별도
     * 엔드포인트로만 추가/삭제되기 때문이다(설계 §3.3.4).
     */
    void applyStops(List<TourCourseStructureInput.StopInput> stopInputs) {
        Map<Long, TourCourseStop> existingById = new LinkedHashMap<>();
        for (TourCourseStop stop : stops) {
            if (stop.getId() != null) {
                existingById.put(stop.getId(), stop);
            }
        }

        for (TourCourseStructureInput.StopInput stopInput : stopInputs) {
            TourCourseStop stop = stopInput.id() != null ? existingById.get(stopInput.id()) : null;

            if (stop == null) {
                stops.add(new TourCourseStop(this, stopInput));
            } else {
                stop.applyInput(stopInput);
            }
        }
    }
}
