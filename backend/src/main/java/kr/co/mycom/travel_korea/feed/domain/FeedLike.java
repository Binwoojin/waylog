package kr.co.mycom.travel_korea.feed.domain;

import jakarta.persistence.*;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "feed_like")
public class FeedLike {

    @EmbeddedId
    private FeedLikeId id;

    @MapsId("feedPostId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "feed_post_id")
    private FeedPost feedPost;


    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private UserEntity user;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public FeedLike(FeedPost feedPost, UserEntity user) {
        this.id = new FeedLikeId(feedPost.getId(), user.getId());
        this.feedPost = feedPost;
        this.user = user;
        this.createdAt = LocalDateTime.now();
    }
}
