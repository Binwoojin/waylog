package kr.co.mycom.travel_korea.feed.domain;

import jakarta.persistence.*;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * feed-comment-integration 설계 §3.1 — 댓글·답글 엔티티(자기 참조).
 *
 * parent가 null이면 최상위 댓글, 값이 있으면 답글입니다. "답글의 답글"을 막기 위한
 * 검증(parent.isReply())은 서비스 계층(FeedCommentService)에서 수행합니다(1단계 제한).
 *
 * Q-2(하드 삭제) 결정에 따라 소프트 삭제 컬럼을 두지 않습니다. 최상위 댓글이 삭제되면
 * replies는 orphanRemoval = true로 함께 삭제됩니다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "feed_comment", indexes = {
        @Index(name = "idx_feed_comment_post_id", columnList = "feed_post_id"),
        @Index(name = "idx_feed_comment_parent_id", columnList = "parent_comment_id")
})
public class FeedComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "feed_comment_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "feed_post_id", nullable = false)
    private FeedPost feedPost;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity author;

    /*
     * null이면 최상위 댓글, 값이 있으면 답글입니다.
     * "답글의 답글"을 막기 위해 서비스 계층에서 parent.getParent() != null(= parent.isReply())을 검증합니다(1단계 제한).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_comment_id")
    private FeedComment parent;

    /*
     * 답글은 부모 댓글이 삭제되면 함께 삭제됩니다(고아 객체 제거, Q-2 하드 삭제 확정).
     * commentCount 갱신은 서비스 계층에서 삭제 전 개수를 세어 처리합니다.
     */
    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<FeedComment> replies = new ArrayList<>();

    @Column(name = "content", nullable = false, length = 500)
    private String content;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public FeedComment(FeedPost feedPost, UserEntity author, FeedComment parent, String content) {
        this.feedPost = feedPost;
        this.author = author;
        this.parent = parent;
        this.content = content;
    }

    public boolean isReply() {
        return parent != null;
    }

    @PrePersist
    private void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }
}
