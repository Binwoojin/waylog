package kr.co.mycom.travel_korea.user.service;

import kr.co.mycom.travel_korea.board.dto.PageResponse;
import kr.co.mycom.travel_korea.user.dto.UserAdminResponse;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

/**
 * 관리자 회원 목록·등급 변경·정지 적용/해제를 처리한다.
 *
 * Design Ref: admin-dashboard 설계 §3.2, §4.1, FR-U06(자기 자신 대상 차단, 403)
 */
@Service
@RequiredArgsConstructor
public class UserAdminService {

    /*
     * 등급 화이트리스트. 프론트 GRADE_OPTIONS(AdminUserDetailPage.jsx)가 보내는
     * 값과 정확히 일치해야 한다. JwtAuthenticationFilter가 "ROLE_" + grade.toUpperCase()로
     * 권한을 만들기 때문에, 목록에 없는 값(빈 문자열/오타 등)이 저장되면 이후 모든
     * hasAuthority 판정에서 매칭되지 않는 이상 상태가 된다.
     */
    private static final Set<String> ALLOWED_GRADES = Set.of("user", "ADMIN");

    private final UserRepository repo;
    private final UserSuspensionService suspensionService;

    /*
     * 목록 화면의 router state로만 상세 데이터를 넘기던 프론트가 새로고침/직접 URL 진입 시
     * 데이터를 잃는 문제를 막기 위한 단건 조회. 존재하지 않는 id 처리 방식은
     * PostService.findPost와 동일하게 IllegalArgumentException -> 400을 그대로 따른다
     * (GlobalExceptionHandler가 공통으로 400 JSON 응답을 내려줌).
     */
    public UserAdminResponse getOne(Long id) {
        return UserAdminResponse.from(findUser(id));
    }

    public PageResponse<UserAdminResponse> list(String keyword, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 50);
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt", "id"));

        Page<UserEntity> result = repo.search(keyword, pageable);
        Page<UserAdminResponse> mapped = result.map(UserAdminResponse::from);
        return PageResponse.from(mapped);
    }

    @Transactional
    public UserAdminResponse updateGrade(Long targetUserId, String currentAdminEmail, String grade) {
        UserEntity target = findUser(targetUserId);
        ensureNotSelf(target, currentAdminEmail);
        ensureValidGrade(grade);
        target.changeGrade(grade);
        return UserAdminResponse.from(target);
    }

    @Transactional
    public UserAdminResponse suspend(Long targetUserId, String currentAdminEmail, int days, String reason) {
        UserEntity target = findUser(targetUserId);
        ensureNotSelf(target, currentAdminEmail);
        UserEntity updated = suspensionService.suspend(targetUserId, days, reason);
        return UserAdminResponse.from(updated);
    }

    @Transactional
    public UserAdminResponse liftSuspension(Long targetUserId, String currentAdminEmail) {
        UserEntity target = findUser(targetUserId);
        ensureNotSelf(target, currentAdminEmail);
        UserEntity updated = suspensionService.lift(targetUserId);
        return UserAdminResponse.from(updated);
    }

    private UserEntity findUser(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("해당 회원을 찾을 수 없습니다."));
    }

    /*
     * 자기 자신을 대상으로 한 등급 변경/정지 호출은 403으로 막는다(FR-U06).
     *
     * AccessDeniedException은 SecurityConfig의 accessDeniedHandler가 처리하므로
     * 별도 ExceptionHandler 없이 기존 403 응답 형식({"message": "접근 권한이 없습니다."})을 그대로 탄다.
     */
    private void ensureNotSelf(UserEntity target, String currentAdminEmail) {
        if (target.getEmail().equals(currentAdminEmail)) {
            throw new AccessDeniedException("본인 계정은 대상으로 지정할 수 없습니다.");
        }
    }

    /*
     * grade는 화이트리스트에 있는 값만 허용한다(null/빈 문자열/오타 차단).
     * IllegalArgumentException은 GlobalExceptionHandler가 기존과 동일한
     * { "message": "..." } 400 응답으로 변환한다.
     */
    private void ensureValidGrade(String grade) {
        if (grade == null || !ALLOWED_GRADES.contains(grade)) {
            throw new IllegalArgumentException("등급 값이 올바르지 않습니다. (user 또는 ADMIN만 가능합니다.)");
        }
    }
}
