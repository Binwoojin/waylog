package kr.co.mycom.travel_korea.board.storage;


import kr.co.mycom.travel_korea.board.storage.StoredObject;
import org.springframework.web.multipart.MultipartFile;

public interface StorageService {
    StoredObject upload(MultipartFile file);
    /**
     * S3에 저장된 파일을 objectKey 기준으로 삭제합니다.
     *
     * @param objectKey DB에 저장해 둔 S3 객체 키
     */
    void delete(String objectKey);
    String createReadUrl(String objectKey);
}
