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

    public void increaseLikeCount() {
        likeCount++;
    }

    public void decreaseLikeCount() {
        likeCount = Math.max(0, likeCount - 1);
    }

    public void increaseCommentCount() {
        commentCount++;
    }

    public void decreaseCommentCount() {
        commentCount = Math.max(0, commentCount - 1);
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
