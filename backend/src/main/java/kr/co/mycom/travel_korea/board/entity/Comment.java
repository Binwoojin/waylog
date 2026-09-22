package kr.co.mycom.travel_korea.board.entity;


import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "comments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Comment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    //n:1관계
    // fetch = FetchType.LAZY : comment를 조회할때 연결된 post를 바로 조회하지 않고 실제로 필요할때 조회(지연연결)
    // optional = false : 게시물없는 댓글은 있을수 없음
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    //fk post_id 설정
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;
    private String author;
    private String content;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Comment(Post post, String author, String content) {
        this.post = post;
        this.author = author;
        this.content = content;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public void update(String author, String content) {
        this.author = author;
        this.content = content;
        this.updatedAt = LocalDateTime.now();
    }
}
