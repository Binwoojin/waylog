package kr.co.mycom.travel_korea.feed;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import kr.co.mycom.travel_korea.feed.domain.FeedPost;
import kr.co.mycom.travel_korea.feed.dto.FeedAdminDeleteRequest;
import kr.co.mycom.travel_korea.feed.dto.FeedAdminPageResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedAdminPostResponse;
import kr.co.mycom.travel_korea.feed.repository.FeedPostRepository;
import kr.co.mycom.travel_korea.feed.service.FeedAdminService;
import kr.co.mycom.travel_korea.feed.service.FeedService;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * admin-dashboard 설계 §3.4, §9.2(시나리오 7~9) — 관리자 피드 목록/상세/삭제 회귀 테스트.
 *
 * 기존 UserAdminValidationTest/UserSuspensionLoginFlowTest와 같은 스타일로
 * MockMvc 없이 서비스와 리포지토리를 직접 호출한다(§11 "새 의존성 금지").
 *
 * 하드 삭제(POLICY_VIOLATION) 테스트는 이미지가 없는 게시글만 사용해
 * storageService.delete가 호출되지 않도록 해 실제 S3 네트워크 호출을 피한다.
 */
@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class FeedAdminServiceTest {

    // UserAdminValidationTest와 같은 관례: 실제 로그인 없이 서비스를 직접 호출하므로
    // "현재 로그인한 관리자" 이메일은 고정 문자열로 넘긴다.
    private static final String ADMIN_EMAIL = "admin-actor@test.com";

    private static ValidatorFactory validatorFactory;
    private static Validator validator;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private FeedPostRepository feedPostRepository;
    @Autowired
    private FeedAdminService feedAdminService;
    @Autowired
    private FeedService feedService;

    @BeforeAll
    static void setUpValidator() {
        validatorFactory = Validation.buildDefaultValidatorFactory();
        validator = validatorFactory.getValidator();
    }

    @AfterAll
    static void tearDownValidator() {
        validatorFactory.close();
    }

    private UserEntity createUser(String email, String nickname) {
        UserEntity user = new UserEntity(email, passwordEncoder.encode("Passw0rd!1"), nickname, "user");
        return userRepository.save(user);
    }

    private FeedPost createPost(UserEntity author, String content) {
        FeedPost post = new FeedPost(author, content, null, null, null, null, null, null, "PUBLIC");
        return feedPostRepository.save(post);
    }

    // 사유가 비어 있으면 @NotBlank 위반이 잡혀야 한다 (Postman 등 직접 호출 방어)
    @Test
    void deleteRequestWithBlankReasonFailsValidation() {
        FeedAdminDeleteRequest request = new FeedAdminDeleteRequest("NORMAL", "", null, null);

        Set<ConstraintViolation<FeedAdminDeleteRequest>> violations = validator.validate(request);

        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("reason")));
    }

    // 회귀 확인: 정상 값은 그대로 통과해야 한다
    @Test
    void deleteRequestWithValidValuesPassesValidation() {
        FeedAdminDeleteRequest request = new FeedAdminDeleteRequest("NORMAL", "광고성 게시물", null, null);

        assertTrue(validator.validate(request).isEmpty());
    }

    // type이 허용된 값이 아니면 400(IllegalArgumentException)으로 막혀야 한다
    @Test
    void deleteWithInvalidTypeThrows() {
        UserEntity author = createUser("feed-admin-invalid-type@test.com", "작성자1");
        FeedPost post = createPost(author, "정상 게시글");

        FeedAdminDeleteRequest request = new FeedAdminDeleteRequest("OTHER", "사유", null, null);

        assertThrows(IllegalArgumentException.class, () -> feedAdminService.delete(post.getId(), request, ADMIN_EMAIL));
    }

    // 시나리오 8: 일반(소프트) 삭제 후 공개 목록(findByVisibilityAndDeletedAtIsNull)에서 제외된다
    @Test
    void normalDeleteExcludesPostFromPublicList() {
        UserEntity author = createUser("feed-admin-normal@test.com", "작성자2");
        FeedPost post = createPost(author, "이번엔 삭제될 정상 게시글");

        feedAdminService.delete(post.getId(), new FeedAdminDeleteRequest("NORMAL", "광고성 게시물", null, null), ADMIN_EMAIL);

        boolean stillInPublicList = feedPostRepository
                .findByVisibilityAndDeletedAtIsNull("PUBLIC", PageRequest.of(0, 50))
                .getContent().stream()
                .anyMatch(p -> p.getId().equals(post.getId()));

        assertFalse(stillInPublicList);

        // 공개 상세 API도 소프트 삭제된 게시물을 "찾을 수 없음"으로 처리해야 한다
        assertThrows(IllegalArgumentException.class, () -> feedService.getOne(post.getId(), null));

        // 관리자 상세에서는 여전히 조회 가능해야 하고 상태/사유가 내려와야 한다
        FeedAdminPostResponse detail = feedAdminService.getOne(post.getId());
        assertEquals("SOFT_DELETED", detail.status());
        assertEquals("광고성 게시물", detail.deleteReason());
        assertNotNull(detail.deletedAt());
    }

    // 시나리오 9: 관리자 목록에서는 소프트 삭제된 글도 상태와 사유를 포함해 계속 보여야 한다
    @Test
    void adminListShowsSoftDeletedPostWithStatus() {
        UserEntity author = createUser("feed-admin-list@test.com", "작성자3");
        FeedPost post = createPost(author, "목록에서 확인할 게시글");

        feedAdminService.delete(post.getId(), new FeedAdminDeleteRequest("NORMAL", "정책 위반은 아니지만 삭제", null, null), ADMIN_EMAIL);

        FeedAdminPageResponse page = feedAdminService.list(1, 50);

        assertTrue(page.items().stream().anyMatch(item ->
                item.id().equals(post.getId())
                        && item.status().equals("SOFT_DELETED")
                        && "정책 위반은 아니지만 삭제".equals(item.deleteReason())
        ));
    }

    // 시나리오 7: 정책위반 삭제는 하드 삭제되어 DB에 행이 남지 않고, suspendAuthor=true면 작성자가 정지된다
    @Test
    void policyViolationDeleteHardDeletesAndSuspendsAuthor() {
        UserEntity author = createUser("feed-admin-policy@test.com", "작성자4");
        FeedPost post = createPost(author, "정책 위반 게시글");
        Long postId = post.getId();

        feedAdminService.delete(postId, new FeedAdminDeleteRequest("POLICY_VIOLATION", "불법 광고", true, 7), ADMIN_EMAIL);

        assertTrue(feedPostRepository.findById(postId).isEmpty());

        UserEntity reloadedAuthor = userRepository.findById(author.getId()).orElseThrow();
        assertTrue(reloadedAuthor.isSuspended());
        assertEquals("불법 광고", reloadedAuthor.getSuspensionReason());
    }

    // 정책위반 삭제인데 suspendAuthor=true이면서 suspensionDays가 없으면 막아야 한다
    @Test
    void policyViolationDeleteWithSuspendAuthorButNoDaysThrows() {
        UserEntity author = createUser("feed-admin-policy-nodays@test.com", "작성자5");
        FeedPost post = createPost(author, "정책 위반 게시글 2");

        FeedAdminDeleteRequest request = new FeedAdminDeleteRequest("POLICY_VIOLATION", "불법 광고", true, null);

        assertThrows(IllegalArgumentException.class, () -> feedAdminService.delete(post.getId(), request, ADMIN_EMAIL));
    }

    // 회귀 확인: 정책위반 삭제라도 suspendAuthor를 지정하지 않으면 작성자는 정지되지 않는다
    @Test
    void policyViolationDeleteWithoutSuspendAuthorLeavesAuthorUntouched() {
        UserEntity author = createUser("feed-admin-policy-nosuspend@test.com", "작성자6");
        FeedPost post = createPost(author, "정책 위반 게시글 3");

        feedAdminService.delete(post.getId(), new FeedAdminDeleteRequest("POLICY_VIOLATION", "불법 광고", null, null), ADMIN_EMAIL);

        UserEntity reloadedAuthor = userRepository.findById(author.getId()).orElseThrow();
        assertFalse(reloadedAuthor.isSuspended());
    }

    // Must Fix 1 회귀 테스트: 관리자가 자기 자신이 작성한 글을 정책위반 삭제하면서
    // 작성자 정지까지 함께 요청하면 자기 자신을 정지시킬 수 없도록 막아야 한다(FR-U06).
    @Test
    void policyViolationDeleteCannotSuspendSelf() {
        UserEntity selfAdmin = createUser("feed-admin-self@test.com", "관리자본인");
        FeedPost post = createPost(selfAdmin, "관리자 본인이 작성한 정책 위반 게시글");
        Long postId = post.getId();

        FeedAdminDeleteRequest request = new FeedAdminDeleteRequest("POLICY_VIOLATION", "불법 광고", true, 7);

        assertThrows(AccessDeniedException.class, () ->
                feedAdminService.delete(postId, request, selfAdmin.getEmail()));

        // 자기 자신 정지가 막히면 삭제 자체도 진행되지 않아야 한다(원자적 실패).
        assertTrue(feedPostRepository.findById(postId).isPresent());

        UserEntity reloadedSelf = userRepository.findById(selfAdmin.getId()).orElseThrow();
        assertFalse(reloadedSelf.isSuspended());
    }
}
