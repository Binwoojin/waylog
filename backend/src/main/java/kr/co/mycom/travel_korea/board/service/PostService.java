package kr.co.mycom.travel_korea.board.service;


import kr.co.mycom.travel_korea.board.dto.*;
import kr.co.mycom.travel_korea.board.entity.Post;
import kr.co.mycom.travel_korea.board.entity.PostImage;
import kr.co.mycom.travel_korea.board.repository.PostRepository;
import kr.co.mycom.travel_korea.board.storage.StorageService;
import kr.co.mycom.travel_korea.board.storage.StoredObject;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PostService {
    private final StorageService storageService;
    private final PostRepository repo;

    public PageResponse<PostListResponse> list (String keyword, int page, int size){
        int safePage = Math.max(0, page);
        int safeSize = Math.min((Math.max(1,size)), 50);
        Pageable pageable = PageRequest.of(safePage,safeSize, Sort.by(Sort.Direction.DESC,"createdAt","id"));
        Page<Post> result =  repo.search(keyword,pageable);
        Page<PostListResponse> map =
            result.map(p -> new PostListResponse(
                p.getId(),
                p.getTitle(),
                p.getAuthor(),
                p.getViewCount(),
                0,
                p.getCreatedAt(),
                false
        ));
         return PageResponse.from(map);
    }

    public void delete(Long id) {
       Post post = findPost(id);
       List<String> keys = post.getImages().stream().map(PostImage::getObjectKey).toList();
       repo.delete(post);
       keys.forEach(key -> safeDelete(key));
    }

    public PostAdminResponse create(PostCreateRequest request, List<MultipartFile> images) {
        List<MultipartFile> safeImages = normalizeFiles(images);
        validateImageCount(safeImages.size());
        Post post = new Post(request.title(),request.content(),request.author());
        List<String> uploadedKeys = new ArrayList<>();
        try{
            for (MultipartFile image : safeImages) {
                StoredObject stored = storageService.upload(image);
                uploadedKeys.add(stored.objectKey());
                post.addImage(new PostImage(
                        stored.objectKey(),
                        stored.originalFilename(),
                        stored.contentType(),
                        stored.size()
                ));
            }
            Post saved = repo.save(post);
            return toDetail(saved);
        } catch(RuntimeException e){
            uploadedKeys.forEach(key->safeDelete(key));
            throw e;
        }
    }
    public PostAdminResponse create(PostCreateRequest request) {
        Post post = new Post(request.title(),request.content(),request.author());
        Post saved = repo.save(post);
        return toDetail(saved);
    }

    private void safeDelete(String key) {
        try{
            storageService.delete(key);
        } catch (RuntimeException e) {}
    }

//    private PostDetailResponse toDetail(Post post) {
//       List<PostImageResponse> imageResponses = post.getImages().stream().map(image -> new PostImageResponse(
//               image.getId(),
//               image.getObjectKey(),
//               image.getOriginalFileName(),
//               image.getContentType(),
//               image.getSize(),
//               storageService.createReadUrl(image.getObjectKey())
//       )).toList();
//        return new PostDetailResponse(post.getId(), post.getTitle(), post.getContent(),
//                post.getAuthor(), post.getViewCount(), post.getCreatedAt(),
//                post.getUpdatedAt(), imageResponses);
//    }

    private PostAdminResponse toDetail(Post post) {
        return new PostAdminResponse(post.getId(), post.getTitle(), post.getContent(),
                post.getAuthor(), post.getViewCount(), post.getCreatedAt(),
                post.getUpdatedAt());
    }

    private List<MultipartFile> normalizeFiles(List<MultipartFile> files) {
        if(files == null || files.isEmpty()) return List.of();
        return files.stream().filter(f-> f!= null&& !f.isEmpty()).toList();
    }

    @Transactional
    public PostAdminResponse get(Long postId) {
        Post post = findPost(postId);
        post.increseViewCount();
        return toDetail(post);
    }

    public Post findPost(Long id) {
        return repo.findById(id).orElseThrow(()-> new IllegalArgumentException("게시글을 찾을 수 없습니다"));
    }
    public PostAdminResponse getWithoutIncreasingView(Long id) {
      return toDetail(findPost(id));
    }

//    @Transactional
//    public PostDetailResponse update(Long id, PostUpdateRequest request, List<MultipartFile> images) {
//        Post post = findPost(id);
//        Set<Long> removeIds = new HashSet<>(request.safeRemoveImageIds());
//        //현재 가지고 있는 이미지중 삭제대상만 골라냄
//        List<PostImage> removing = post.getImages().stream()
//                .filter(image -> removeIds.contains(image.getId()))
//                .toList();
//        //게시물 1개에 여러장의 이미지 사용 여부
//        int remaining = post.getImages().size()-removing.size();
//        List<MultipartFile> safeNewImages = normalizeFiles(images);
//        validateImageCount(remaining + safeNewImages.size());
//        List<String> uploadKeys = new ArrayList<>();
//
//        try{
//            for (MultipartFile image : safeNewImages) {
//                StoredObject stored = storageService.upload(image);
//                uploadKeys.add(stored.objectKey());
//                post.addImage(new PostImage(stored.objectKey(), stored.originalFilename(), stored.contentType(), stored.size()));
//            }
//            post.update(request.title(), request.content(), request.author());
//            for (PostImage image : removing) {
//                post.removeImage(image);
//                safeDelete(image.getObjectKey());
//            }
//                return toDetail(post);
//        }catch(RuntimeException e){
//            uploadKeys.forEach(key->safeDelete(key));
//            throw e;
//        }
//    }

    /**
     * 이미지 없이 제목, 내용, 작성자만 수정합니다.
     */

    @Transactional
    public PostAdminResponse update(Long id, PostUpdateRequest request) {
        Post post = findPost(id);

        post.update(
                request.title(),
                request.content(),
                request.author()
        );

        /*
         * JPA 변경 감지가 트랜잭션 종료 시 UPDATE 쿼리를 실행합니다.
         */

        return toDetail(post);

    }

    /**
     * 공지사항의 텍스트와 이미지를 함께 수정합니다.
     *
     * - removeImageIds: 기존 이미지 삭제 대상
     * - images: 새로 추가할 이미지
     */

    @Transactional
    public PostAdminResponse update(Long id, PostUpdateRequest request, List<MultipartFile> images) {
        Post post = findPost(id);

        Set<Long> removeImageIds = new HashSet<>(request.safeRemoveImageIds());

        List<PostImage> removingImages = post.getImages().stream()
                .filter(image -> removeImageIds.contains(image.getId()))
                .toList();

        List<MultipartFile> newImages = normalizeFiles(images);

        int remainingImageCount = post.getImages().size() - removingImages.size();

        validateImageCount(remainingImageCount + newImages.size());

        List<String> uploadedKeys = new ArrayList<>();

        try {
            // 새 이미지를 S3에 업로드하고 게시글과 연결
            for (MultipartFile image : newImages) {
                StoredObject stored = storageService.upload(image);
                uploadedKeys.add(stored.objectKey());

                post.addImage(new PostImage(
                        stored.objectKey(),
                        stored.originalFilename(),
                        stored.contentType(),
                        stored.size()
                ));
            }
            // 텍스트 정보를 수정
            post.update(
                    request.title(),
                    request.content(),
                    request.author()
            );

            // 삭제 요청된 기존 이미지를 DB와 S3에서 삭제
            for (PostImage image : removingImages) {
                post.removeImage(image);
                safeDelete(image.getObjectKey());
            }

            return toDetail(post);
        } catch (RuntimeException exception) {
            /*
             * 업로드 중 예외가 발생하면 이번 요청에서 새로 업로드한
             * S3 파일만 정리합니다.
             */
            uploadedKeys.forEach(this::safeDelete);
            throw exception;
        }
    }

    @Value("${app.upload.max-image-count}")
    private int maxImageCount;

    /**
     * 공지사항 하나에 등록할 수 있는 이미지 개수를 제한합니다.
     */
    private void validateImageCount(int size) {
        if (size > maxImageCount) {
            throw new IllegalArgumentException("이미지는 최대 " + maxImageCount + "장까지 등록할 수 있습니다.");
        }
    }
}
