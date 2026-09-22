package kr.co.mycom.travel_korea.board.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name="post_images")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PostImage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;
    private String objectKey;
    private String originalFileName;
    private String contentType;
    private Long size;
    public PostImage(String s,String s1,String s2, long size) {
        this.objectKey = s;
        this.originalFileName = s1;
        this.contentType = s2;
        this.size = size;
    }

    void setPost(Post post) {
        this.post = post;
    }
}
