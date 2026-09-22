package kr.co.mycom.travel_korea.tour.bookmark.domain;

import jakarta.persistence.*;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 사용자가 저장한 TourAPI 관광 콘텐츠입니다.
 *
 * TourAPI를 북마크 목록 조회 때마다 다시 호출하지 않도록
 * 제목, 이미지, 주소 등 카드 표시용 데이터를 함께 저장합니다.
 */


@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(
        name = "tour_bookmark",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_tour_bookmark_user_content",
                        columnNames = {"user_id", "content_id", "content_type_id"}
                )
        }
)
public class TourBookmark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tour_bookmark_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "content_id", nullable = false, length = 30)
    private String contentId;

    @Column(name = "content_type_id", nullable = false)
    private Integer contentTypeId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "image_url", length = 1000)
    private String imageUrl;

    @Column(length = 500)
    private String address;

    @Column(name = "category_name", length = 100)
    private String categoryName;

    @Enumerated(EnumType.STRING)
    @Column(name = "category_group", nullable = false, length = 20)
    private TourBookmarkGroup categoryGroup;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public TourBookmark(
            UserEntity user,
            String contentId,
            Integer contentTypeId,
            String title,
            String imageUrl,
            String address,
            String categoryName,
            TourBookmarkGroup categoryGroup
    ) {
        this.user = user;
        this.contentId = contentId;
        this.contentTypeId = contentTypeId;
        this.title = title;
        this.imageUrl = imageUrl;
        this.address = address;
        this.categoryName = categoryName;
        this.categoryGroup = categoryGroup;
        this.createdAt = LocalDateTime.now();
    }
}
