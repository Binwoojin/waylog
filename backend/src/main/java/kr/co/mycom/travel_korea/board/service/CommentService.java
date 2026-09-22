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
    public CommentResponse create(Long postId, String authorEmail, CommentRequest request) {
        Post post = postRepo.findById(postId).orElseThrow(()-> new EntityNotFoundException("게시글을 찾을 수 없습니다."));
        Comment comment = commentRepo.save(new Comment(post,authorEmail,request.content()));
        return toResponse(comment);

    }

    /*
     * 댓글 수정/삭제는 작성자 본인 또는 관리자만 허용합니다.
     * comment.update()는 관리 대상 엔티티 상태에서 호출되어야 실제로 DB에 반영되므로
     * @Transactional 경계 안에서 조회부터 수정까지 수행합니다.
     */
    @Transactional
    public CommentResponse update(Long commentId, String requesterEmail, boolean isAdmin, CommentRequest request) {
        Comment comment = commentRepo.findById(commentId).orElseThrow(()-> new IllegalArgumentException("댓글을 찾을 수 없습니다."));
        validateOwner(comment, requesterEmail, isAdmin);
        comment.update(comment.getAuthor(), request.content());
        return toResponse(comment);
    }

    @Transactional
    public void delete(Long commentId, String requesterEmail, boolean isAdmin) {
        Comment comment = commentRepo.findById(commentId).orElseThrow(()-> new IllegalArgumentException("삭제하려는 댓글이 없습니다."));
        validateOwner(comment, requesterEmail, isAdmin);
        commentRepo.delete(comment);
    }

    private void validateOwner(Comment comment, String requesterEmail, boolean isAdmin) {
        if (isAdmin) {
            return;
        }

        if (!comment.getAuthor().equals(requesterEmail)) {
            throw new IllegalArgumentException("댓글 작성자만 수정하거나 삭제할 수 있습니다.");
        }
    }
}
