package kr.co.mycom.travel_korea.board.controller;



import kr.co.mycom.travel_korea.board.dto.*;
import kr.co.mycom.travel_korea.board.entity.Post;
import kr.co.mycom.travel_korea.board.service.PostService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")

public class PostController {
    private final PostService postService;
    // localhost:8080/api/posts?keyword=키보드
    @GetMapping("/notices")
    public PageResponse<PostListResponse> list
    (@RequestParam(required = false)String keyword,
     @RequestParam(defaultValue = "0")int page,
     @RequestParam(defaultValue = "10") int size) {
        // keyword : 키보드 , page = 0 , size = 10
        return postService.list(keyword, page, size);
    }
    @GetMapping("/notices/{noticeId}")
    public PostAdminResponse get(@PathVariable Long noticeId){
        return postService.get(noticeId);
    }

    @PatchMapping("/admin/notices/{noticeId}")
    public PostAdminResponse getForEdit(@PathVariable Long noticeId){
        return postService.getWithoutIncreasingView(noticeId);
    }

    /**
     * 관리자 공지사항을 생성합니다.
     *
     * 생성된 게시글 정보를 응답으로 반환해야
     * 프론트가 생성 직후 상세 화면 또는 목록으로 이동할 수 있습니다.
     */

    @PostMapping("/admin/notices")
    public ResponseEntity<PostAdminResponse> createNotices(@RequestBody PostCreateRequest request){

        PostAdminResponse response = postService.create(request);

       return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

//    @PostMapping(value = "/admin/notices",consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
//    public ResponseEntity<PostDetailResponse> create(
//            @RequestPart("post") PostCreateRequest request,
//            @RequestPart(value = "images", required = false) List<MultipartFile> images
//    ) {
//        return ResponseEntity.status(HttpStatus.CREATED)
//                .body(postService.create(request, images));
//    }

    @PutMapping(value = "/admin/notices/{noticeId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PostAdminResponse update(
            @PathVariable Long noticeId,
            @RequestPart("post") PostUpdateRequest request,
            @RequestPart(value = "images", required = false) List<MultipartFile> images
    ) {
        return postService.update(noticeId, request, images);

    }

    @DeleteMapping("admin/notices/{noticeId}")
    public ResponseEntity<Void> delete(@PathVariable Long noticeId){
        postService.delete(noticeId);
        return ResponseEntity.noContent().build();
    }



}
