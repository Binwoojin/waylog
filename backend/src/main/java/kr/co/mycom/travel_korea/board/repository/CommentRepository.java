package kr.co.mycom.travel_korea.board.repository;

import kr.co.mycom.travel_korea.board.entity.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {

    List<Comment> findByPost_idOrderByCreatedAtAsc(Long postId);
}
