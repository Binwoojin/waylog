package kr.co.mycom.travel_korea.feed.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "feed_photo")
public class FeedPhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "feed_photo_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "feed_post_id", nullable = false)
    private FeedPost feedPost;

    /*
     * 실제 이미지 파일을 DB에 넣지 않고
     * S3, 로컬 스토리지 등에 저장된 이미지 주소만 저장합니다.
     */
    @Column(name = "image_url", nullable = false, length = 500)
    private String imageUrl;

    @Column(name = "original_file_name", length = 255)
    private String originalFileName;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;


    /**
     * 피드 게시글과 S3 이미지 정보를 연결합니다.
     *
     * imageUrl에는 실제 URL이 아니라 S3 objectKey를 저장합니다.
     */

    public FeedPhoto(
            FeedPost feedPost,
            String objectKey,
            String originalFileName,
            int sortOrder
    ) {
        this.feedPost = feedPost;
        this.imageUrl = objectKey;
        this.originalFileName = originalFileName;
        this.sortOrder = sortOrder;
    }
}
