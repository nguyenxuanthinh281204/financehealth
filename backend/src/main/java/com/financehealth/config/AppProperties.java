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

    public record Storage(String type, String localDir, String publicBaseUrl,
                          String s3Bucket, String s3Region, long signedUrlMinutes) {}

    public record Receipt(String anthropicApiKey, String model) {}

    public record Moments(double maxVideoSeconds) {}
}
