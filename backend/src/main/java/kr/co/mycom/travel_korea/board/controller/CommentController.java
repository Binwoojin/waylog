package kr.co.mycom.travel_korea.board.controller;


import kr.co.mycom.travel_korea.board.dto.CommentRequest;
import kr.co.mycom.travel_korea.board.dto.CommentResponse;
import kr.co.mycom.travel_korea.board.service.CommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(postId, request)).getBody();
    }

    @PutMapping("/comments/{commentId}")
    public CommentResponse updateComment(@PathVariable("commentId") Long commentId, @RequestBody CommentRequest request){
        return service.update(commentId,request);
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable("commentId") Long commentId){
        service.delete(commentId);
        return ResponseEntity.noContent().build();
    }
}
