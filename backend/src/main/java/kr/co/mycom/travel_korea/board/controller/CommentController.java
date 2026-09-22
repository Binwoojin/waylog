package kr.co.mycom.travel_korea.board.controller;


import kr.co.mycom.travel_korea.board.dto.CommentRequest;
import kr.co.mycom.travel_korea.board.dto.CommentResponse;
import kr.co.mycom.travel_korea.board.service.CommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CommentController {
    private final CommentService service;

    @GetMapping("/posts/{postId}/comments")
    public List<CommentResponse> getComments(@PathVariable("postId") Long postId){
        return service.list(postId);
    }

    @PostMapping("/posts/{PostId}/comments")
    public CommentResponse addComment(@PathVariable("PostId") Long postId, @RequestBody CommentRequest request){
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(postId, currentEmail(), request)).getBody();
    }

    @PutMapping("/comments/{commentId}")
    public CommentResponse updateComment(@PathVariable("commentId") Long commentId, @RequestBody CommentRequest request){
        return service.update(commentId, currentEmail(), isAdmin(), request);
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable("commentId") Long commentId){
        service.delete(commentId, currentEmail(), isAdmin());
        return ResponseEntity.noContent().build();
    }

    /*
     * 댓글 작성자/수정자/삭제자는 요청 본문이 아니라
     * JwtAuthenticationFilter가 인증 성공 시 심어둔 SecurityContext의
     * 이메일을 사용해야 클라이언트가 다른 사람 이름으로 위장할 수 없습니다.
     */
    private String currentEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }
        return authentication.getName();
    }

    private boolean isAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals);
    }
}
