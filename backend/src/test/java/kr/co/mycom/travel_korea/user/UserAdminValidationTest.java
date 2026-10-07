package kr.co.mycom.travel_korea.user;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import kr.co.mycom.travel_korea.user.dto.UserSuspensionRequest;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import kr.co.mycom.travel_korea.user.service.UserAdminService;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 코드 리뷰 Should Improve 2건에 대한 서버측 검증 회귀 테스트
 * (admin-dashboard 설계 §3.2.2 "사유 필수", §4.1 등급 화이트리스트).
 *
 * - UserSuspensionRequest: @NotBlank(reason), @Min/@Max(days) 검증
 *   (spring-boot-starter-validation이 이미 의존성에 있어 새 의존성 없이
 *    jakarta.validation.Validator를 직접 사용한다. 기존
 *    UserSuspensionLoginFlowTest와 같은 이유로 MockMvc는 쓰지 않는다).
 * - UserAdminService.updateGrade: 화이트리스트에 없는 값은 IllegalArgumentException(400).
 */
@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class UserAdminValidationTest {

    private static ValidatorFactory validatorFactory;
    private static Validator validator;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private UserAdminService userAdminService;

    @BeforeAll
    static void setUpValidator() {
        validatorFactory = Validation.buildDefaultValidatorFactory();
        validator = validatorFactory.getValidator();
    }

    @AfterAll
    static void tearDownValidator() {
        validatorFactory.close();
    }

    private UserEntity createUser(String email, String nickname, String grade) {
        UserEntity user = new UserEntity(email, passwordEncoder.encode("Passw0rd!1"), nickname, grade);
        return userRepository.save(user);
    }

    // 1) 정지 사유가 비어 있으면 @NotBlank 위반이 잡혀야 한다 (Postman 등 직접 호출 방어)
    @Test
    void suspensionRequestWithBlankReasonFailsValidation() {
        UserSuspensionRequest request = new UserSuspensionRequest(3, "");

        Set<ConstraintViolation<UserSuspensionRequest>> violations = validator.validate(request);

        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("reason")));
    }

    @Test
    void suspensionRequestWithNullReasonFailsValidation() {
        UserSuspensionRequest request = new UserSuspensionRequest(3, null);

        Set<ConstraintViolation<UserSuspensionRequest>> violations = validator.validate(request);

        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("reason")));
    }

    // 회귀 확인: 정상 값(사유 있음, 1~365일)은 그대로 통과해야 한다
    @Test
    void suspensionRequestWithValidValuesPassesValidation() {
        UserSuspensionRequest request = new UserSuspensionRequest(30, "정책 위반");

        Set<ConstraintViolation<UserSuspensionRequest>> violations = validator.validate(request);

        assertTrue(violations.isEmpty());
    }

    @Test
    void suspensionRequestDaysOutOfRangeFailsValidation() {
        UserSuspensionRequest tooLong = new UserSuspensionRequest(366, "사유");
        UserSuspensionRequest tooShort = new UserSuspensionRequest(0, "사유");

        assertFalse(validator.validate(tooLong).isEmpty());
        assertFalse(validator.validate(tooShort).isEmpty());
    }

    // 2) 화이트리스트에 없는 등급 값은 거부되어야 한다 (오타/임의 문자열 방어)
    @Test
    void updateGradeWithInvalidValueThrows() {
        UserEntity target = createUser("grade-invalid@test.com", "대상회원1", "user");

        assertThrows(IllegalArgumentException.class, () ->
                userAdminService.updateGrade(target.getId(), "admin-actor@test.com", "SUPERADMIN"));
    }

    @Test
    void updateGradeWithBlankValueThrows() {
        UserEntity target = createUser("grade-blank@test.com", "대상회원2", "user");

        assertThrows(IllegalArgumentException.class, () ->
                userAdminService.updateGrade(target.getId(), "admin-actor@test.com", ""));
    }

    @Test
    void updateGradeWithNullValueThrows() {
        UserEntity target = createUser("grade-null@test.com", "대상회원3", "user");

        assertThrows(IllegalArgumentException.class, () ->
                userAdminService.updateGrade(target.getId(), "admin-actor@test.com", null));
    }

    // 회귀 확인: 화이트리스트 값(user/ADMIN)은 그대로 변경되어야 한다
    @Test
    void updateGradeWithAllowedValuesSucceeds() {
        UserEntity target = createUser("grade-valid@test.com", "대상회원4", "user");

        var response = userAdminService.updateGrade(target.getId(), "admin-actor@test.com", "ADMIN");

        assertEquals("ADMIN", response.grade());
    }
}
