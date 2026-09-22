package kr.co.mycom.travel_korea.board.storage;


import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@ConditionalOnProperty(
        name="app.storage.type", havingValue="s3",matchIfMissing=true
)
public class S3StorageService implements StorageService{
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("image/jpeg","image/png","image/gif","image/webp");
    private final S3Client s3Client;
    private final S3Presigner presigner;
    private final String bucket;
    private final Long maxBytes;
    private final Duration readUrlDuration;


    public S3StorageService(S3Client s3Client, S3Presigner presigner,
                            @Value("${app.s3.bucket}")String bucket,
                            @Value("${app.max-file-size-byte}")Long maxBytes,
                            @Value("${app.s3.presigned-url-minutes}") Long readUrlMinutes) {
        this.s3Client = s3Client;
        this.presigner =presigner;
        this.bucket = bucket;
        this.maxBytes =  maxBytes;
        this.readUrlDuration = Duration.ofMinutes(readUrlMinutes);
    }

    @Override
    public StoredObject upload(MultipartFile file)  {
        validate(file);
        String original = sanitizeFilename(file.getOriginalFilename());
        String contentType = file.getContentType();
        String key = "myboard/"+ UUID.randomUUID()+extensionFor(contentType);
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .contentLength(file.getSize())
                .build();
        try {
            s3Client.putObject(request, RequestBody.fromBytes(file.getBytes()));
        } catch (IOException e) {
            throw new RuntimeException("이미지파일 읽기 실패",e);
        }
        return new StoredObject(key,original,contentType,file.getSize());
    }

    private String extensionFor(String contentType) {
        return switch (contentType){
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            default -> "";
        };
    }


    /**
     * S3 업로드 전에 파일 형식과 크기를 검증합니다.
     *
     * 조건을 만족하지 못하면 예외를 발생시켜
     * S3 업로드와 DB 저장이 진행되지 않도록 합니다.
     */

    private void validate(MultipartFile file){
        if(file== null || file.isEmpty()){
            throw new IllegalArgumentException("업로드할 이미지 파일이 없습니다.");
        }
        if(file.getSize() > maxBytes) {
            throw new IllegalArgumentException("이미지 파일 용량이 제한을 초과했습니다.");
        }

        String contentType = file.getContentType();

        if(contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)){
            throw new IllegalArgumentException("jpeg, png, gif, webp 형식의 이미지만 업로드할 수 있습니다.");
        }
    }
    // 순수한 파일명만 반환시키기
    // ex) c://test/veryLongLocaltion.../photo1.png => photo1.png
    private  String sanitizeFilename(String filename){
        if (filename == null || filename.isBlank()) return "image";
        String nomalized = filename.replace('\\','/');
        int index = nomalized.lastIndexOf('/');
        return index >= 0 ? nomalized.substring(index + 1) : nomalized;

    }
    @Override
    public void delete(String objectKey) {
        if(objectKey == null || objectKey.isBlank()) return ;

        try {
            DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .build();

            s3Client.deleteObject(deleteRequest);
        } catch (Exception exception) {
            /*
             * 게시글 DB 삭제까지 실패시키면 사용자가 게시글을 지울 수 없게 됩니다.
             * 따라서 우선 로그를 남기고, 운영 환경에서는 재시도 작업 대상으로 관리합니다.
             */
            log.error("S3 이미지 삭제에 실패했습니다. objectKey={}", objectKey, exception);
        }


    }

    @Override
    public String createReadUrl(String objectKey) {
       GetObjectRequest getObjectRequest = GetObjectRequest.builder()
               .bucket(bucket)
               .key(objectKey)
               .build();
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
               .signatureDuration(readUrlDuration)
                .getObjectRequest(getObjectRequest)
                .build();
        return presigner.presignGetObject(presignRequest).url().toString();
    }
}
