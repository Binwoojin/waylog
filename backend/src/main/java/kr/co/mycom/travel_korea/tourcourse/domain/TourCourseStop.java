package kr.co.mycom.travel_korea.tourcourse.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.BatchSize;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * 여행코스 경유지. REFERENCE/CUSTOM 두 방식을 모두 저장할 수 있는 구조다
 * (설계 §3.3.2, D-1 설계 제약). REFERENCE는 tourContentId/tourContentTypeId를
 * 참조하고 name/address/좌표는 스냅샷으로 저장한다(FeedPost.tourContentId와 동일한 패턴).
 *
 * images는 findById(EntityGraph로 days.stops까지만 fetch)에서 함께 조회하지 않고
 * @BatchSize로 배치 로딩한다 — FeedPostRepository의 "photos+tags를 동시에 fetch join하면
 * 결과가 곱으로 늘어난다"는 것과 같은 이유로, 3단 중첩 컬렉션 fetch join을 피한다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "tour_course_stop")
public class TourCourseStop {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tour_course_stop_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_day_id", nullable = false)
    private TourCourseDay day;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "stop_type", nullable = false, length = 20)
    private StopType stopType;

    @Column(name = "tour_content_id", length = 30)
    private String tourContentId;

    @Column(name = "tour_content_type_id")
    private Integer tourContentTypeId;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "address", length = 255)
    private String address;

    @Column(name = "latitude", precision = 10, scale = 7)
    private BigDecimal latitude;

    @Column(name = "longitude", precision = 10, scale = 7)
    private BigDecimal longitude;

    @OneToMany(mappedBy = "stop", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    @BatchSize(size = 20)
    private List<TourCourseStopImage> images = new ArrayList<>();

    TourCourseStop(TourCourseDay day, TourCourseStructureInput.StopInput input) {
        this.day = day;
        applyInput(input);
    }

    /**
     * 기존 경유지를 유지하면서 필드만 최신 요청 값으로 교체한다(구조 전체 교체,
     * 설계 §4.1). 이미지 목록은 건드리지 않는다 — 이미지는 별도 엔드포인트로만
     * 추가/삭제되기 때문이다(설계 §3.3.4).
     */
    void applyInput(TourCourseStructureInput.StopInput input) {
        this.sortOrder = input.sortOrder();
        this.stopType = input.stopType();
        this.tourContentId = input.tourContentId();
        this.tourContentTypeId = input.tourContentTypeId();
        this.name = input.name();
        this.address = input.address();
        this.latitude = input.latitude();
        this.longitude = input.longitude();
    }

    public void addImage(String objectKey, int sortOrder) {
        images.add(new TourCourseStopImage(this, objectKey, sortOrder));
    }

    public void removeImage(TourCourseStopImage image) {
        images.remove(image);
    }
}
