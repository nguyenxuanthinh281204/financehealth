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

    /** provider: anthropic (mặc định) hoặc gemini. */
    public record Receipt(String provider, String anthropicApiKey, String model, Gemini gemini) {}

    /** Gemini trên Vertex AI; location "global" chạy được mọi model mới. */
    public record Gemini(String project, String location, String model) {}

    public record Moments(double maxVideoSeconds) {}
}
