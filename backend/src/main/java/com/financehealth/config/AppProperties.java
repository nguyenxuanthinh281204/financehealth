package com.financehealth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        List<String> corsOrigins,
        Jwt jwt,
        Storage storage,
        Receipt receipt,
        Moments moments) {

    public record Jwt(String secret, long ttlHours) {}

    /**
     * s3Endpoint để trống = AWS S3. Điền endpoint (vd. https://hn.ss.bfcplatform.vn) để dùng
     * Object Storage chuẩn S3 của nhà cung cấp khác, kèm access key/secret key của họ.
     */
    public record Storage(String type, String localDir, String publicBaseUrl,
                          String s3Bucket, String s3Region, long signedUrlMinutes,
                          String s3Endpoint, String s3AccessKey, String s3SecretKey, boolean s3PathStyle) {}

    public record Receipt(String anthropicApiKey, String model) {}

    public record Moments(double maxVideoSeconds) {}
}
