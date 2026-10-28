package com.financehealth.finance.receipt;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.models.messages.*;
import com.financehealth.config.AppProperties;
import com.financehealth.finance.receipt.ReceiptExtraction.ReceiptData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Base64;
import java.util.List;
import java.util.Optional;

/**
 * Đọc hóa đơn bằng Claude (vision + structured output). Đọc tốt hóa đơn tiếng Việt,
 * kể cả bill viết tay hoặc in nhiệt bị mờ. Dùng khi RECEIPT_PROVIDER=anthropic (mặc định),
 * tắt khi không cấu hình ANTHROPIC_API_KEY.
 */
@Component
@ConditionalOnProperty(name = "app.receipt.provider", havingValue = "anthropic", matchIfMissing = true)
public class ClaudeReceiptScanner implements ReceiptScanner {

    private static final Logger log = LoggerFactory.getLogger(ClaudeReceiptScanner.class);

    private final AnthropicClient client;
    private final String model;

    public ClaudeReceiptScanner(AppProperties props) {
        String key = props.receipt().anthropicApiKey();
        this.model = props.receipt().model();
        this.client = key == null || key.isBlank() ? null : AnthropicOkHttpClient.builder().apiKey(key).build();
    }

    @Override
    public boolean enabled() {
        return client != null;
    }

    @Override
    public Optional<Extracted> scan(byte[] image, String mediaType) {
        if (client == null) return Optional.empty();

        StructuredMessageCreateParams<ReceiptData> params = buildParams(model, image, mediaType);

        try {
            StructuredMessage<ReceiptData> response = client.messages().create(params);
            if (response.stopReason().filter(r -> r.equals(StopReason.REFUSAL)).isPresent()) {
                log.warn("Receipt scan refused");
                return Optional.empty();
            }
            return response.content().stream()
                    .flatMap(block -> block.text().stream())
                    .map(StructuredTextBlock::text)
                    .filter(ReceiptData::isReceipt)
                    .findFirst()
                    .map(ReceiptExtraction::toExtracted);
        } catch (RateLimitException e) {
            log.warn("Receipt scan rate limited: {}", e.getMessage());
            return Optional.empty();
        } catch (AnthropicServiceException e) {
            log.error("Receipt scan failed: status={} {}", e.statusCode(), e.getMessage());
            return Optional.empty();
        } catch (RuntimeException e) {
            log.error("Receipt scan failed", e);
            return Optional.empty();
        }
    }

    static StructuredMessageCreateParams<ReceiptData> buildParams(String model, byte[] image, String mediaType) {
        ImageBlockParam imageBlock = ImageBlockParam.builder()
                .source(Base64ImageSource.builder()
                        .mediaType(toMediaType(mediaType))
                        .data(Base64.getEncoder().encodeToString(image))
                        .build())
                .build();

        return MessageCreateParams.builder()
                .model(model)
                .maxTokens(16000L)
                .outputConfig(ReceiptData.class)
                .addUserMessageOfBlockParams(List.of(
                        ContentBlockParam.ofImage(imageBlock),
                        ContentBlockParam.ofText(TextBlockParam.builder().text(ReceiptExtraction.PROMPT).build())))
                // Nếu model từ chối vì bộ lọc an toàn, server tự chuyển sang model dự phòng
                .putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
                .build();
    }

    private static Base64ImageSource.MediaType toMediaType(String contentType) {
        return switch (contentType == null ? "" : contentType.toLowerCase()) {
            case "image/png" -> Base64ImageSource.MediaType.IMAGE_PNG;
            case "image/webp" -> Base64ImageSource.MediaType.IMAGE_WEBP;
            case "image/gif" -> Base64ImageSource.MediaType.IMAGE_GIF;
            default -> Base64ImageSource.MediaType.IMAGE_JPEG;
        };
    }
}
