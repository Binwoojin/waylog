package kr.co.mycom.travel_korea.feed;

import kr.co.mycom.travel_korea.feed.domain.FeedPost;
import kr.co.mycom.travel_korea.feed.dto.FeedTimelineResponse;
import kr.co.mycom.travel_korea.feed.repository.FeedPostRepository;
import kr.co.mycom.travel_korea.feed.service.FeedService;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

/**
 * feed-integration 설계 §4.2(P-3) — 커서 기반 무한 스크롤 타임라인 회귀 테스트.
 *
 * FeedAdminServiceTest와 같은 스타일로 MockMvc 없이 서비스와 리포지토리를 직접 호출한다
 * (설계 §11 "새 의존성 금지"). id는 IDENTITY 채번이라 생성 순서와 항상 일치한다는 설계
 * 근거를 이용해, "직전에 만든 글의 id = 방금 만든 글의 id - 1"이라는 사실만으로 전역 데이터
 * 오염 없이 순서·필터링을 검증한다(다른 테스트가 만든 게시물이 몇 개 섞여 있어도 영향받지 않음).
 */
@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class FeedTimelineCursorTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private FeedPostRepository feedPostRepository;
    @Autowired
    private FeedService feedService;

    private UserEntity createUser(String email, String nickname) {
        UserEntity user = new UserEntity(email, passwordEncoder.encode("Passw0rd!1"), nickname, "user");
        return userRepository.save(user);
    }

    private FeedPost createPost(UserEntity author, String content, String visibility) {
        FeedPost post = new FeedPost(author, content, null, null, null, null, null, null, visibility);
        return feedPostRepository.save(post);
    }

    // 커서(cursor)보다 id가 작은(더 오래된) 게시물만 반환하고, cursor 자신은 포함하지 않는다.
    @Test
    void cursorExcludesItselfAndReturnsOnlyOlderPosts() {
        UserEntity author = createUser("feed-cursor-basic@test.com", "커서작성자1");
        FeedPost older = createPost(author, "커서 이전 글", "PUBLIC");
        FeedPost cursorPost = createPost(author, "커서로 사용할 글", "PUBLIC");

        // 두 글이 연속으로 생성되었으므로 id가 정확히 1 차이여야 한다(순차 실행 전제).
        assertEquals(older.getId() + 1, cursorPost.getId());

        FeedTimelineResponse response = feedService.getFeed(null, cursorPost.getId(), 50);

        assertTrue(response.posts().stream().noneMatch(p -> p.id().equals(cursorPost.getId())),
                "cursor로 지정한 게시물 자신은 결과에 포함되면 안 된다");
        assertTrue(response.posts().stream().allMatch(p -> p.id() < cursorPost.getId()),
                "cursor보다 id가 크거나 같은 게시물은 반환되면 안 된다");

        // ORDER BY id DESC이므로 cursor 바로 아래(older)가 결과의 첫 항목이어야 한다.
        assertFalse(response.posts().isEmpty());
        assertEquals(older.getId(), response.posts().get(0).id());
    }

    // PRIVATE 게시물은 최신 글이라도 공개 타임라인에 나타나면 안 된다.
    @Test
    void privatePostIsExcludedFromPublicTimeline() {
        UserEntity author = createUser("feed-cursor-private@test.com", "커서작성자2");
        FeedPost publicPost = createPost(author, "공개 글", "PUBLIC");
        FeedPost privatePost = createPost(author, "비공개 글", "PRIVATE");

        assertEquals(publicPost.getId() + 1, privatePost.getId());

        // privatePost 바로 다음 id를 커서로 써서, "지금 시점 최신 공개글"이 무엇인지 확인한다.
        FeedTimelineResponse response = feedService.getFeed(null, privatePost.getId() + 1, 50);

        assertTrue(response.posts().stream().noneMatch(p -> p.id().equals(privatePost.getId())),
                "PRIVATE 게시물은 결과에 포함되면 안 된다");
        assertFalse(response.posts().isEmpty());
        // PRIVATE는 건너뛰어지므로 정렬상 다음으로 최신인 publicPost가 첫 항목이어야 한다.
        assertEquals(publicPost.getId(), response.posts().get(0).id());
    }

    // 소프트 삭제(deletedAt not null)된 게시물은 공개 타임라인에서 제외된다.
    @Test
    void softDeletedPostIsExcludedFromPublicTimeline() {
        UserEntity author = createUser("feed-cursor-deleted@test.com", "커서작성자3");
        FeedPost baseline = createPost(author, "기준 공개 글", "PUBLIC");
        FeedPost softDeleted = createPost(author, "소프트 삭제될 글", "PUBLIC");

        assertEquals(baseline.getId() + 1, softDeleted.getId());

        softDeleted.softDelete("테스트 삭제");
        feedPostRepository.save(softDeleted);

        FeedTimelineResponse response = feedService.getFeed(null, softDeleted.getId() + 1, 50);

        assertTrue(response.posts().stream().noneMatch(p -> p.id().equals(softDeleted.getId())),
                "소프트 삭제된 게시물은 결과에 포함되면 안 된다");
        assertFalse(response.posts().isEmpty());
        assertEquals(baseline.getId(), response.posts().get(0).id());
    }

    /*
     * size보다 하나 더 조회해 hasNext를 판단한다(§4.2, COUNT 쿼리 없이 다음 페이지 존재 여부를
     * 아는 방식). 이 테스트는 "size개보다 많은 게시물이 남아 있으면 hasNext=true"만 검증한다
     * ("정확히 size개만 남으면 hasNext=false"는 다른 테스트가 이미 만들어 둔 전역 데이터가
     * 몇 건인지 통제할 수 없어 공유 DB 환경에서 결정적으로 검증하기 어렵다 — 반대로 "내가
     * 직접 3건을 더 추가했다"는 사실은 다른 테스트가 무엇을 남겼든 항상 참이므로 안전하다).
     */
    @Test
    void hasNextIsTrueWhenMoreThanSizeItemsRemain() {
        UserEntity author = createUser("feed-cursor-hasnext@test.com", "커서작성자4");
        FeedPost oldest = createPost(author, "가장 오래된 글", "PUBLIC");
        FeedPost middle = createPost(author, "중간 글", "PUBLIC");
        FeedPost newest = createPost(author, "cursor 바로 아래 글", "PUBLIC");
        FeedPost cursorHolder = createPost(author, "마커 글(요청 기준점)", "PUBLIC");

        assertEquals(newest.getId() + 1, cursorHolder.getId());

        // cursor보다 오래된 것이 최소 3건(oldest, middle, newest) 존재하므로 size=2 요청은 항상 잘려야 한다.
        FeedTimelineResponse response = feedService.getFeed(null, cursorHolder.getId(), 2);

        assertEquals(2, response.posts().size());
        assertEquals(newest.getId(), response.posts().get(0).id());
        assertEquals(middle.getId(), response.posts().get(1).id());
        assertEquals(middle.getId(), response.nextCursor());
        assertTrue(response.hasNext());
        // oldest는 이번 페이지에 아직 포함되지 않아야 한다(다음 페이지 몫).
        assertTrue(response.posts().stream().noneMatch(p -> p.id().equals(oldest.getId())));
    }

    // 응답의 nextCursor는 항상 마지막으로 반환된 게시물의 id다(프론트가 다음 요청에 그대로 되돌려 보낼 opaque 값).
    @Test
    void nextCursorMatchesLastReturnedPostId() {
        UserEntity author = createUser("feed-cursor-nextcursor@test.com", "커서작성자5");
        createPost(author, "글 A", "PUBLIC");
        FeedPost lastPost = createPost(author, "글 B(가장 오래된 글)", "PUBLIC");
        FeedPost cursorHolder = createPost(author, "커서 기준 글", "PUBLIC");

        FeedTimelineResponse response = feedService.getFeed(null, cursorHolder.getId(), 50);

        assertFalse(response.posts().isEmpty());
        Long actualLastId = response.posts().get(response.posts().size() - 1).id();
        assertEquals(actualLastId, response.nextCursor());
    }
}
