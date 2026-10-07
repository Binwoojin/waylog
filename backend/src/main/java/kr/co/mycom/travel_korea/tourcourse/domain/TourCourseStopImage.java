package kr.co.mycom.travel_korea.tourcourse.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 여행코스 경유지 이미지. FeedPhoto와 같은 모양(엔티티, objectKey 저장, cascade는
 * 부모(TourCourseStop)가 소유). Design Ref: admin-dashboard 설계 §3.3.1.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "tour_course_stop_image")
public class TourCourseStopImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tour_course_stop_image_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stop_id", nullable = false)
    private TourCourseStop stop;

    /*
     * S3 objectKey만 저장한다(FeedPhoto.imageUrl과 동일한 관례). 실제 표시용 URL은
     * 응답 시점에 StorageService.createReadUrl(objectKey)로 변환한다.
     */
    @Column(name = "object_key", nullable = false, length = 500)
    private String objectKey;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    TourCourseStopImage(TourCourseStop stop, String objectKey, int sortOrder) {
        this.stop = stop;
        this.objectKey = objectKey;
        this.sortOrder = sortOrder;
    }
}
