package kr.co.mycom.travel_korea.board.entity;


import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "posts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Post {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "title")
    private String title;
    private String content;
    private String author;
    // 1:N관계, 재귀적으로 모두 선택,부모없는 자식도 제거 가능
    @OneToMany(mappedBy = "post",cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PostImage> images = new ArrayList<>();
    private Long viewCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Post(String title, String content, String author) {
        this.title = title;
        this.content = content;
        this.author = author;
        this.viewCount = 0L;
        this.createdAt = LocalDateTime.now();
    }

    @PrePersist
    void onCreate() {
        LocalDateTime now =  LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }
    @PreUpdate
    void onUpdate() {
        LocalDateTime now =  LocalDateTime.now();
        this.updatedAt = now;
    }

    /**
     * 게시글에 이미지 한 장을 연결합니다.
     *
     * 양방향 연관관계이므로 게시글의 이미지 목록에 추가하고,
     * 이미지 객체에도 현재 게시글을 설정해야 합니다.
     */

    public void addImage(PostImage images) {
        this.images.add(images);
        images.setPost(this);
    }

    public void increseViewCount() {
        this.viewCount +=1;
    }

    public void update(String title, String content, String author) {
        this.title = title;
        this.content = content;
        this.author = author;
    }

    public void removeImage(PostImage postImage) {
        images.remove(postImage);
        postImage.setPost(null);
    }
}
