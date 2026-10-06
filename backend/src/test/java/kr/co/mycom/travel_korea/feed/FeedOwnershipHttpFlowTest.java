package kr.co.mycom.travel_korea.feed;

import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.feed.domain.FeedPost;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentCreateRequest;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentResponse;
import kr.co.mycom.travel_korea.feed.repository.FeedPostRepository;
import kr.co.mycom.travel_korea.feed.service.FeedCommentService;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 타인의 게시물·댓글 삭제가 400이 아니라 403으로 응답하는지, 본인 삭제는 그대로 성공하는지
 * 실제 HTTP 요청으로 검증한다.
 *
 * 권한 위반은 ForbiddenException(403)으로, 입력값 오류는 IllegalArgumentException(400)으로 구분된다.
 * 응답 메시지는 기존 문구를 그대로 유지한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "local-mock"})
class FeedOwnershipHttpFlowTest {

    private static final String RAW_PASSWORD = "Passw0rd!1";
    private static final String POST_OWNER_MESSAGE = "게시글 작성자만 수정하거나 삭제할 수 있습니다.";
    private static final String COMMENT_OWNER_MESSAGE = "본인 댓글만 삭제할 수 있습니다.";

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private JwtConfig jwtConfig;
    @Autowired
    private FeedPostRepository feedPostRepository;
    @Autowired
    private FeedCommentService feedCommentService;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    private UserEntity createUser(String prefix) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        return userRepository.save(new UserEntity(
                prefix + "-" + suffix + "@test.com",
                passwordEncoder.encode(RAW_PASSWORD),
                prefix.charAt(0) + suffix,
                "user"
        ));
    }

    private String tokenOf(UserEntity user) throws Exception {
        return jwtConfig.createAccessToken(user.getEmail());
    }

    private FeedPost createPost(UserEntity author) {
        return feedPostRepository.save(
                new FeedPost(author, "소유권 검증용 게시물", null, null, null, null, null, null, "PUBLIC")
        );
    }

    private HttpResponse<String> delete(String path, String accessToken) throws Exception {
        return httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:" + port + path))
                        .header("Authorization", "Bearer " + accessToken)
                        .DELETE()
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );
    }

    // 타인이 게시물을 삭제하면 403이고, 게시물은 그대로 남아야 한다.
    @Test
    void deletingOthersPostReturns403AndKeepsPost() throws Exception {
        UserEntity owner = createUser("owner");
        UserEntity stranger = createUser("stranger");
        FeedPost post = createPost(owner);

        HttpResponse<String> response = delete("/api/v1/feed/posts/" + post.getId(), tokenOf(stranger));

        assertEquals(403, response.statusCode(), response.body());
        assertTrue(response.body().contains(POST_OWNER_MESSAGE), response.body());
        assertTrue(feedPostRepository.existsById(post.getId()), "권한이 없으면 게시물은 삭제되지 않아야 한다");
    }

    // 작성자 본인은 게시물을 삭제할 수 있다(204).
    @Test
    void deletingOwnPostReturns204() throws Exception {
        UserEntity owner = createUser("owner");
        FeedPost post = createPost(owner);

        HttpResponse<String> response = delete("/api/v1/feed/posts/" + post.getId(), tokenOf(owner));

        assertEquals(204, response.statusCode(), response.body());
        assertFalse(feedPostRepository.existsById(post.getId()));
    }

    // 타인이 댓글을 삭제하면 403이고, 댓글은 그대로 남아야 한다.
    @Test
    void deletingOthersCommentReturns403AndKeepsComment() throws Exception {
        UserEntity postOwner = createUser("postowner");
        UserEntity commenter = createUser("commenter");
        UserEntity stranger = createUser("stranger");
        FeedPost post = createPost(postOwner);
        FeedCommentResponse comment = feedCommentService.create(
                post.getId(), commenter.getEmail(), new FeedCommentCreateRequest("타인 삭제 시도 대상", null));

        HttpResponse<String> response = delete(
                "/api/v1/feed/posts/" + post.getId() + "/comments/" + comment.id(), tokenOf(stranger));

        assertEquals(403, response.statusCode(), response.body());
        assertTrue(response.body().contains(COMMENT_OWNER_MESSAGE), response.body());
    }

    // 댓글 작성자 본인은 댓글을 삭제할 수 있다(200, 삭제 수 1).
    @Test
    void deletingOwnCommentReturns200() throws Exception {
        UserEntity postOwner = createUser("postowner");
        UserEntity commenter = createUser("commenter");
        FeedPost post = createPost(postOwner);
        FeedCommentResponse comment = feedCommentService.create(
                post.getId(), commenter.getEmail(), new FeedCommentCreateRequest("본인 삭제 대상", null));

        HttpResponse<String> response = delete(
                "/api/v1/feed/posts/" + post.getId() + "/comments/" + comment.id(), tokenOf(commenter));

        assertEquals(200, response.statusCode(), response.body());
        assertTrue(response.body().contains("\"removedCount\":1"), response.body());
    }
}
