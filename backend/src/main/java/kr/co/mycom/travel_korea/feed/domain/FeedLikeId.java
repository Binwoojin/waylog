package kr.co.mycom.travel_korea.feed.domain;


import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Embeddable
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class FeedLikeId implements Serializable {

    @Column(name = "feed_post_id")
    private Long feedPostId;

    @Column(name = "user_id")
    private Long userId;
}
