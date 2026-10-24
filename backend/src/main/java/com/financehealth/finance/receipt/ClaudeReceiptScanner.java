package com.financehealth.finance.receipt;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.models.messages.*;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import com.financehealth.config.AppProperties;
import com.financehealth.finance.Expense;
import com.financehealth.finance.ExpenseDtos.LineItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

/**
 * Đọc hóa đơn bằng Claude (vision + structured output). Đọc tốt hóa đơn tiếng Việt,
 * kể cả bill viết tay hoặc in nhiệt bị mờ. Tắt khi không cấu hình ANTHROPIC_API_KEY.
 */
@Component
public class ClaudeReceiptScanner implements ReceiptScanner {

    private static final Logger log = LoggerFactory.getLogger(ClaudeReceiptScanner.class);

    private static final String PROMPT = """
            Đây là ảnh chụp hóa đơn / bill thanh toán ở Việt Nam. Hãy đọc và trả về:
            - isReceipt: false nếu ảnh không phải hóa đơn.
            - merchant: tên cửa hàng.
            - date: ngày trên hóa đơn dạng YYYY-MM-DD, để trống nếu không có.
            - total: tổng tiền khách phải trả bằng VND (số nguyên, bỏ dấu chấm phân cách nghìn).
            - category: một trong FOOD (ăn uống, quán, cà phê), GROCERIES (siêu thị, đi chợ), TRANSPORT,
              SHOPPING, BILLS (điện nước, internet), HEALTH (thuốc, khám), ENTERTAINMENT, EDUCATION, OTHER.
            - items: từng dòng hàng với tên, số lượng và thành tiền VND.
            Không bịa số liệu không có trên ảnh.
            """;

    public record ReceiptItem(String name, double quantity, long price) {}

    public record ReceiptData(
            @JsonPropertyDescription("false nếu ảnh không phải hóa đơn") boolean isReceipt,
            String merchant,
            @JsonPropertyDescription("YYYY-MM-DD hoặc chuỗi rỗng") String date,
            @JsonPropertyDescription("Tổng tiền VND") long total,
            String category,
            List<ReceiptItem> items) {}

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
                    .map(ClaudeReceiptScanner::toExtracted);
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
                        ContentBlockParam.ofText(TextBlockParam.builder().text(PROMPT).build())))
                // Nếu model từ chối vì bộ lọc an toàn, server tự chuyển sang model dự phòng
                .putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
                .build();
    }

    private static Extracted toExtracted(ReceiptData d) {
        LocalDate date = null;
        if (d.date() != null && !d.date().isBlank()) {
            try {
                date = LocalDate.parse(d.date().trim());
            } catch (DateTimeParseException ignored) {
                // để người dùng tự chọn ngày
            }
        }
        Expense.Category category;
        try {
            category = Expense.Category.valueOf(d.category() == null ? "OTHER" : d.category().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            category = Expense.Category.OTHER;
        }
        List<LineItem> items = d.items() == null ? List.of() : d.items().stream()
                .filter(i -> i.name() != null && !i.name().isBlank())
                .map(i -> new LineItem(i.name().trim(), BigDecimal.valueOf(i.quantity()), BigDecimal.valueOf(i.price())))
                .toList();
        return new Extracted(d.merchant(), date, d.total() > 0 ? BigDecimal.valueOf(d.total()) : null, category, items);
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
