package kr.co.mycom.travel_korea.feed.domain;

import jakarta.persistence.*;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.core.annotation.Order;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "feed_post", indexes = {
        @Index(name = "idx_feed_post_created_at", columnList = "created_at"),
        @Index(name = "idx_feed_post_user_id", columnList = "user_id")
    }
)
public class FeedPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "feed_post_id")
    private Long id;

    /*
     * 기존 users 테이블의 회원과 게시글 작성자를 연결합니다.
     * 회원을 삭제하더라도 게시글을 어떻게 처리할지는 추후 정책으로 결정해야 합니다.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity author;

    @Column(name = "content", nullable = false, length = 2000)
    private String content;

    @Column(name = "location_name", length = 150)
    private String locationName;

    @Column(name = "address", length = 255)
    private String address;

    /*
     * 카카오 지도 마커를 표시하기 위한 좌표입니다.
     * double보다 DB 정밀도를 명확하게 관리할 수 있는 BigDecimal을 사용합니다.
     */
    @Column(name = "latitude", precision = 10, scale = 7)
    private BigDecimal latitude;

    @Column(name = "longitude", precision = 10, scale = 7)
    private BigDecimal longitude;

    /*
     * TourAPI 데이터를 매번 호출하지 않고도 장소를 식별할 수 있도록
     * 콘텐츠 식별값만 게시글에 저장합니다.
     */
    @Column(name = "tour_content_id", length = 30)
    private String tourContentId;

    @Column(name = "tour_content_type_id")
    private Integer tourContentTypeId;

    /*
     * 여행코스 참조(tour-course-feed-linking 설계 §3). TourAPI 참조(tourContentId)와
     * 완전히 독립된 필드다 — 한 게시물이 TourAPI 위치와 코스 참조를 모두 가질 수도,
     * 하나만 가질 수도, 둘 다 없을 수도 있다.
     *
     * "코스 전체만" 가리키는 상태는 허용하지 않는다(설계 §3.2) — linkedCourseDayId가
     * null이 아니면 linkedCourseId도 항상 함께 채워진다(서버가 일자→코스 체인으로 직접
     * 채우므로 둘이 따로 노는 상태 자체가 만들어지지 않는다). linkedCourseStopId는
     * linkedCourseDayId가 있을 때만 추가로 설정될 수 있다.
     *
     * ON DELETE SET NULL(DB 레벨, 마이그레이션 backend/db/migrations/2026-10-01-tour-course-feed-linking.sql)로
     * 코스/일자/경유지가 삭제되면 이 세 id는 자동으로 null이 된다. 스냅샷 컬럼(제목/일자
     * 번호/경유지명)은 FK가 아니라 일반 컬럼이라 삭제의 영향을 받지 않고 그대로 남는다 —
     * "참조했던 코스가 이후 삭제/변경됨"을 사용자에게 보여줄 수 있는 근거가 된다.
     *
     * @ManyToOne이 아니라 단순 @Column인 이유는 설계 §3.1 참고 — feed 모듈이 tourcourse
     * 모듈의 엔티티 클래스를 몰라도 되게 하기 위함(모듈 결합 최소화).
     */
    @Column(name = "linked_course_id")
    private Long linkedCourseId;

    @Column(name = "linked_course_title", length = 200)
    private String linkedCourseTitle;

    @Column(name = "linked_course_day_id")
    private Long linkedCourseDayId;

    @Column(name = "linked_course_day_number")
    private Integer linkedCourseDayNumber;

    @Column(name = "linked_course_stop_id")
    private Long linkedCourseStopId;

    @Column(name = "linked_course_stop_name", length = 150)
    private String linkedCourseStopName;

    @Column(name = "visibility", nullable = false, length = 20)
    private String visibility = "PUBLIC";

    /*
     * 피드 목록마다 COUNT 쿼리를 실행하지 않도록 개수를 게시글에 저장합니다.
     */
    @Column(name = "like_count", nullable = false)
    private long likeCount;

    @Column(name = "comment_count", nullable = false)
    private long commentCount;

    @OneToMany(mappedBy = "feedPost", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<FeedPhoto> photos = new ArrayList<>();

    /*
     * feed-comment-integration 설계 §3.1 — 게시물 삭제 시 댓글·답글도 함께 정리되도록
     * cascade + orphanRemoval을 photos와 동일한 방식으로 연결한다. FeedService.delete()는
     * 이 연관관계 덕분에 코드 변경 없이 댓글까지 하드 삭제한다.
     */
    @OneToMany(mappedBy = "feedPost", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<FeedComment> comments = new ArrayList<>();

    /*
     * 태그는 별도 엔티티 동작이 필요하지 않아 ElementCollection으로 관리합니다.
     */
    @ElementCollection
    @CollectionTable(name = "feed_tag", joinColumns = @JoinColumn(name = "feed_post_id"))
    @Column(name = "tag_name", length = 50, nullable = false)
    private Set<String> tags = new LinkedHashSet<>();

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /*
     * 관리자 소프트 삭제(admin-dashboard 설계 §3.4.1).
     *
     * null이면 정상 노출, 값이 있으면 소프트 삭제됨. 정책위반(하드) 삭제는 행 자체가
     * 사라지므로 이 두 컬럼에 값이 남지 않는다(설계 §3.4.1, 의도된 트레이드오프).
     */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "delete_reason", length = 255)
    private String deleteReason;

    public FeedPost(UserEntity author, String content, String locationName, String address, BigDecimal latitude, BigDecimal longitude, String tourContentId, Integer tourContentTypeId, String visibility) {
        this.author = author;
        this.content = content;
        this.locationName = locationName;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
        this.tourContentId = tourContentId;
        this.tourContentTypeId = tourContentTypeId;
        this.visibility = visibility == null ? "PUBLIC" : visibility;
        this.likeCount = 0;
        this.commentCount = 0;
    }

    public void update(String content, String locationName, String address, BigDecimal latitude, BigDecimal longitude, String tourContentId, Integer tourContentTypeId, String visibility) {
        this.content = content;
        this.locationName = locationName;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
        this.tourContentId = tourContentId;
        this.tourContentTypeId = tourContentTypeId;
        this.visibility = visibility == null ? "PUBLIC" : visibility;
    }

    /*
     * 여행코스 참조를 붙인다(tour-course-feed-linking 설계 §3.1 — replaceTags/replacePhotos와
     * 같은 레벨의 post-construction mutator). 생성자에 더 얹지 않고 생성 직후 별도 호출로
     * 분리한다. 전부 null을 넘기면 "미태그" 상태가 된다(CourseLinkResolver.resolve가 둘 다
     * null일 때 반환하는 empty() 스냅샷과 대응).
     */
    public void linkCourse(Long courseId, String courseTitle, Long dayId, Integer dayNumber, Long stopId, String stopName) {
        this.linkedCourseId = courseId;
        this.linkedCourseTitle = courseTitle;
        this.linkedCourseDayId = dayId;
        this.linkedCourseDayNumber = dayNumber;
        this.linkedCourseStopId = stopId;
        this.linkedCourseStopName = stopName;
    }

    /*
     * 스냅샷 컬럼(linkedCourseTitle) 기준으로 판단한다. 코스/일자/경유지가 각각
     * ON DELETE SET NULL로 사라져도 linkedCourseTitle 등 스냅샷 텍스트는 남아있으므로,
     * dayId 같은 FK 컬럼을 게이트로 쓰면 코스 삭제 시 스냅샷 전체가 응답에서 사라진다
     * (design §5.3 — 삭제된 참조는 스냅샷 텍스트로 표시되어야 한다).
     */
    public boolean hasCourseLink() {
        return linkedCourseTitle != null;
    }

    public void replaceTags(List<String> tagNames) {
        tags.clear();

        if (tagNames == null) {
            return;
        }

        tagNames.stream().filter(tag -> tag != null && !tag.isBlank()).map(String::trim)
                .map(tag -> tag.startsWith("#") ? tag.substring(1) : tag).limit(10).forEach(tags::add);
    }

    public void replacePhotos(List<String> imageUrls) {
        photos.clear();

        if (imageUrls == null) {
            return;
        }

        for (int index = 0; index < imageUrls.size(); index++) {
            String imageUrl = imageUrls.get(index);

            if (imageUrl != null && !imageUrl.isBlank()) {
                photos.add(new FeedPhoto(this, imageUrl.trim(), null, index));
            }
        }
    }

    /**
     * S3 업로드가 완료된 사진 한 장을 게시글에 연결합니다.
     *
     * FeedPhoto 생성 시 this를 전달하므로
     * 게시글과 사진의 연관관계가 함께 설정됩니다.
     */

    public void addPhoto(
            String objectKey,
            String originalFileName,
            int sortOrder
    ) {
        photos.add(
                new FeedPhoto(
                        this,
                        objectKey,
                        originalFileName,
                        sortOrder
                )
        );
    }

    /**
     * 관리자 일반(소프트) 삭제를 적용한다. DB 행은 유지하고 노출만 막는다.
     *
     * Design Ref: admin-dashboard 설계 §3.4.3 — type=NORMAL
     */
    public void softDelete(String reason) {
        this.deletedAt = LocalDateTime.now();
        this.deleteReason = reason;
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public void increaseLikeCount() {
        likeCount++;
    }

    public void decreaseLikeCount() {
        likeCount = Math.max(0, likeCount - 1);
    }

    @PrePersist
    private void prePresent() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    private void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
