package kr.co.mycom.travel_korea.tourcourse.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 관리자 전용 여행코스 도메인의 최상위 애그리게잇.
 *
 * Design Ref: admin-dashboard 설계 §3.3.1 (3단 구조:
 * TourCourse - TourCourseDay - TourCourseStop - TourCourseStopImage).
 *
 * 코스 -> 일자 -> 경유지 -> 경유지 이미지는 cascade = CascadeType.ALL, orphanRemoval = true로
 * 소유한다(DB 행 정리는 JPA가 담당). 다만 S3 객체 삭제는 JPA cascade가 알지 못하므로
 * 서비스 레이어(TourCourseAdminService)에서 명시적으로 objectKey를 수집해
 * StorageService.delete()를 호출한다.
 *
 * 이번 범위에는 피드(SNS) 연동 필드를 추가하지 않는다(설계 §8, 의도적으로 유보됨).
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "tour_course")
public class TourCourse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tour_course_id")
    private Long id;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "theme", length = 100)
    private String theme;

    /*
     * 코스 목록 카드용 대표 이미지. 일자당 이미지 10장 제한(경유지 이미지)과는
     * 무관한 별도 슬롯이다(설계 §3.3.4-4).
     */
    @Column(name = "cover_image_object_key", length = 500)
    private String coverImageObjectKey;

    @OneToMany(mappedBy = "course", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("dayNumber ASC")
    private List<TourCourseDay> days = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public TourCourse(String title, String theme) {
        this.title = title;
        this.theme = theme;
    }

    public void changeCoverImage(String objectKey) {
        this.coverImageObjectKey = objectKey;
    }

    /**
     * 구조 교체 1단계: 요청에 다시 나타나지 않는 기존 일자/경유지를 먼저 제거한다.
     *
     * 삭제와 삽입을 한 번의 flush에서 함께 처리하면, Hibernate가 기본적으로 삭제보다
     * 삽입을 먼저 실행하기 때문에 "(course_id, day_number)" 유니크 제약이 걸린 슬롯을
     * 새 일자가 재사용하는 순간(예: 기존 1일차를 지우고 새 1일차를 추가) 일시적으로
     * 두 행이 공존해 제약을 위반할 수 있다. 그래서 서비스(TourCourseAdminService)가
     * 이 메서드로 제거만 먼저 반영해 flush한 뒤, applyStructure()로 나머지를 반영한다.
     *
     * 제거되는 경유지가 가지고 있던 이미지는 호출자가 S3 정리를 하도록 반환값으로
     * 모아 돌려준다(설계 §3.3.1 "S3 객체 삭제는 서비스 레이어에서 명시적으로 처리").
     */
    public List<TourCourseStopImage> pruneUnreferenced(List<TourCourseStructureInput.DayInput> dayInputs) {
        Set<Long> keepDayIds = new HashSet<>();
        Map<Long, TourCourseStructureInput.DayInput> dayInputById = new LinkedHashMap<>();

        for (TourCourseStructureInput.DayInput dayInput : dayInputs) {
            if (dayInput.id() != null) {
                keepDayIds.add(dayInput.id());
                dayInputById.put(dayInput.id(), dayInput);
            }
        }

        List<TourCourseStopImage> removedImages = new ArrayList<>();

        days.removeIf(day -> {
            if (day.getId() == null) {
                return false;
            }

            if (!keepDayIds.contains(day.getId())) {
                for (TourCourseStop stop : day.getStops()) {
                    removedImages.addAll(stop.getImages());
                }
                return true;
            }

            // 유지되는 일자라도 그 안의 경유지 중 요청에 다시 나타나지 않는 것은 함께 정리한다.
            removedImages.addAll(day.pruneUnreferencedStops(dayInputById.get(day.getId()).stops()));
            return false;
        });

        return removedImages;
    }

    /**
     * 구조 교체 1.5단계: 살아남는(요청에도 다시 나타나는) 기존 일자들에게 서로 충돌하지
     * 않는 임시 dayNumber를 부여한다.
     *
     * 두 일자의 순서를 맞바꾸는 경우(예: 기존 1일차<->2일차), applyStructure()가 최종
     * dayNumber를 곧바로 적용하면 "(course_id, day_number)" 유니크 제약을 위반한다 —
     * 맞바꾸기라서 중간 임시값 없이는 어느 UPDATE가 먼저 실행되든 상대방이 아직 점유 중인
     * 값과 충돌하기 때문이다. pruneUnreferenced()가 "삭제된 일자" 슬롯 충돌을 막아주는
     * 것과 같은 이유로, 이 메서드는 "살아있는 일자끼리 값을 맞바꾸는" 충돌을 막는다.
     *
     * 각 일자의 id를 음수로 뒤집어 임시값으로 쓴다 — id는 유일하므로 임시값도 서로 유일하고,
     * 실제 dayNumber(항상 1 이상의 양수)와도 절대 겹치지 않는다.
     */
    public void assignTemporaryDayNumbers() {
        for (TourCourseDay day : days) {
            if (day.getId() != null) {
                day.changeDayNumber(-Math.toIntExact(day.getId()));
            }
        }
    }

    /**
     * 구조 교체 2단계: 코스명/테마를 갱신하고, 유지되는 일자/경유지의 필드를 최신 값으로
     * 바꾸고, 요청에만 있는 새 일자/경유지를 추가한다. pruneUnreferenced()로 충돌
     * 가능성이 있는 슬롯을 먼저 비우고, assignTemporaryDayNumbers()로 살아남는 일자끼리의
     * 맞바꾸기 충돌까지 피한 뒤에 호출해야 한다(설계 §4.1 "구조 전체 교체").
     *
     * create()에서도 그대로 재사용한다 — 새 코스는 기존 일자가 없으므로 모든 입력이
     * 자연스럽게 "신규 생성" 분기를 타서 별도의 create 전용 로직이 필요 없다.
     */
    public void applyStructure(String title, String theme, List<TourCourseStructureInput.DayInput> dayInputs) {
        this.title = title;
        this.theme = theme;

        Map<Long, TourCourseDay> existingById = new LinkedHashMap<>();
        for (TourCourseDay day : days) {
            if (day.getId() != null) {
                existingById.put(day.getId(), day);
            }
        }

        for (TourCourseStructureInput.DayInput dayInput : dayInputs) {
            TourCourseDay day = dayInput.id() != null ? existingById.get(dayInput.id()) : null;

            if (day == null) {
                day = new TourCourseDay(this, dayInput.dayNumber());
                days.add(day);
            } else {
                day.changeDayNumber(dayInput.dayNumber());
            }

            day.applyStops(dayInput.stops());
        }
    }

    @PrePersist
    private void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    private void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
