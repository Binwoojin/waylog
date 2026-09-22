package kr.co.mycom.travel_korea.board.repository;


import kr.co.mycom.travel_korea.board.entity.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {
    //Native Query(네이티브 쿼리)
    @Query(
            value = "SELECT * FROM POSTS WHERE TITLE LIKE %:KEYWORD%"
            , nativeQuery = true
    )
    List<Post> getOne(String keyword, Pageable pageable);
    //JPQL (Custom Query)
    @Query("""
    select p from Post p 
    where (:keyword is null or :keyword= ''
    or lower(p.title) like lower(concat('%', :keyword, '%'))
    or lower(p.content) like lower(concat('%', :keyword, '%')) 
    or lower(p.author) like lower(concat('%', :keyword, '%'))    
            )
    """)
    Page<Post> search (String keyword, Pageable pageable);

    Page<Post> findAllByOrderByCreatedAtDesc (Pageable pageable);

    //Post findPost(Long id);
}
