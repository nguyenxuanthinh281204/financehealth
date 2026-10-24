package com.financehealth.storage;

import com.financehealth.config.AppProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.InputStream;
import java.net.URI;
import java.time.Duration;

/**
 * Lưu file trên S3 (bucket private). Trên AWS, quyền truy cập lấy từ IAM role của máy chủ
 * nên không cần access key. Với Object Storage chuẩn S3 của nhà cung cấp khác thì cấu hình
 * S3_ENDPOINT + S3_ACCESS_KEY + S3_SECRET_KEY.
 */
@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "s3")
public class S3StorageService implements StorageService {

    private final S3Client s3;
    private final S3Presigner presigner;
    private final String bucket;
    private final Duration ttl;

    public S3StorageService(AppProperties props) {
        AppProperties.Storage cfg = props.storage();
        Region region = Region.of(cfg.s3Region() == null || cfg.s3Region().isBlank() ? "us-east-1" : cfg.s3Region());
        boolean custom = cfg.s3Endpoint() != null && !cfg.s3Endpoint().isBlank();
        AwsCredentialsProvider credentials = cfg.s3AccessKey() != null && !cfg.s3AccessKey().isBlank()
                ? StaticCredentialsProvider.create(AwsBasicCredentials.create(cfg.s3AccessKey(), cfg.s3SecretKey()))
                : DefaultCredentialsProvider.builder().build();
        S3Configuration s3Config = S3Configuration.builder().pathStyleAccessEnabled(custom && cfg.s3PathStyle()).build();

        S3ClientBuilder client = S3Client.builder().region(region).credentialsProvider(credentials)
                .serviceConfiguration(s3Config);
        S3Presigner.Builder presign = S3Presigner.builder().region(region).credentialsProvider(credentials)
                .serviceConfiguration(s3Config);
        if (custom) {
            URI endpoint = URI.create(cfg.s3Endpoint());
            // Nhiều dịch vụ chuẩn S3 chưa hỗ trợ checksum CRC mặc định của SDK mới, chỉ gửi khi bắt buộc
            client.endpointOverride(endpoint)
                    .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                    .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED);
            presign.endpointOverride(endpoint);
        }
        this.s3 = client.build();
        this.presigner = presign.build();
        this.bucket = cfg.s3Bucket();
        this.ttl = Duration.ofMinutes(props.storage().signedUrlMinutes());
        if (bucket == null || bucket.isBlank()) {
            throw new IllegalStateException("Thiếu S3_BUCKET khi STORAGE_TYPE=s3");
        }
    }

    @Override
    public void put(String key, InputStream data, long size, String contentType) {
        s3.putObject(PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType).build(),
                RequestBody.fromInputStream(data, size));
    }

    @Override
    public String signedUrl(String key) {
        GetObjectPresignRequest req = GetObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .getObjectRequest(GetObjectRequest.builder().bucket(bucket).key(key).build())
                .build();
        return presigner.presignGetObject(req).url().toString();
    }

    @Override
    public void delete(String key) {
        s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
    }
}
