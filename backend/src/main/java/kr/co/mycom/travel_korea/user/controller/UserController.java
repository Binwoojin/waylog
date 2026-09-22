package kr.co.mycom.travel_korea.user.controller;

import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import kr.co.mycom.travel_korea.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class UserController {
    private final UserService service;

    @GetMapping("users/check-email")
    public ResponseEntity<Map<String, Boolean>> checkEmail(@RequestParam("email") String email) {
        /*
         * 이미 존재하면 available=false,
         * 존재하지 않으면 available=true를 반환합니다.
         */
        boolean available = !service.existEmail(email);

        return ResponseEntity.ok(Map.of("available", available));
    }

    @GetMapping("users/check-nickname")
    public ResponseEntity<Map<String, Boolean>> checkNickname(@RequestParam("nickname") String nickname) {

        boolean available = !service.existNickname(nickname);

        return ResponseEntity.ok(Map.of("available", available));
    }


}

