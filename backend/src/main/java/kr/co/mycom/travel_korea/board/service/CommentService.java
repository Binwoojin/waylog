package kr.co.mycom.travel_korea.board.service;


import jakarta.persistence.EntityNotFoundException;
import kr.co.mycom.travel_korea.board.dto.CommentRequest;
import kr.co.mycom.travel_korea.board.dto.CommentResponse;
import kr.co.mycom.travel_korea.board.entity.Comment;
import kr.co.mycom.travel_korea.board.entity.Post;
import kr.co.mycom.travel_korea.board.repository.CommentRepository;
import kr.co.mycom.travel_korea.board.repository.PostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CommentService {
    private final CommentRepository commentRepo;
    private final PostRepository postRepo;

    @Transactional
    public List<CommentResponse> list(Long postId) {
        if (!postRepo.existsById(postId)){throw new EntityNotFoundException("게시글이 없습니다.");}
        return commentRepo.findByPost_idOrderByCreatedAtAsc(postId).stream().map(this::toResponse).toList();
    }

    private CommentResponse toResponse(Comment comment) {
     return new CommentResponse(comment.getId(),comment.getPost().getId(),comment.getAuthor(),comment.getContent(),comment.getCreatedAt(),comment.getUpdatedAt());
    }

    @Transactional
    public CommentResponse create(Long postId, CommentRequest request) {
        Post post = postRepo.findById(postId).orElseThrow(()-> new EntityNotFoundException("게시글을 찾을 수 없습니다."));
        Comment comment = commentRepo.save(new Comment(post,request.author(),request.content()));
        return toResponse(comment);

    }

    public CommentResponse update(Long commentId, CommentRequest request) {
        Comment comment = commentRepo.findById(commentId).orElseThrow(()-> new IllegalArgumentException("댓글을 찾을 수 없습니다."));
        comment.update(request.author(), request.content());
        return toResponse(comment);
    }

    public void delete(Long commentId) {
        Comment comment = commentRepo.findById(commentId).orElseThrow(()-> new IllegalArgumentException("삭제하려는 댓글이 없습니다."));
        commentRepo.delete(comment);
    }
}
