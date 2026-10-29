package com.financehealth.finance.receipt;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.financehealth.config.AppProperties;
import com.financehealth.finance.receipt.ReceiptExtraction.ReceiptData;
import com.google.genai.Client;
import com.google.genai.errors.ApiException;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Đọc hóa đơn bằng Gemini trên Vertex AI (Google Cloud). Dùng khi RECEIPT_PROVIDER=gemini.
 * Xác thực bằng service account qua GOOGLE_APPLICATION_CREDENTIALS. Vertex AI trừ vào credit
 * dùng thử của Google Cloud, còn Gemini API của AI Studio thì không, nên chỉ hỗ trợ Vertex AI.
 * Tắt khi không cấu hình GCP_PROJECT_ID hoặc không tạo được client.
 */
@Component
@ConditionalOnProperty(name = "app.receipt.provider", havingValue = "gemini")
public class GeminiReceiptScanner implements ReceiptScanner {

    private static final Logger log = LoggerFactory.getLogger(GeminiReceiptScanner.class);

    /** JSON Schema của {@link ReceiptData}, Gemini trả đúng dạng này. */
    static final Map<String, Object> RESPONSE_SCHEMA = Map.of(
            "type", "object",
            "properties", Map.of(
                    "isReceipt", Map.of("type", "boolean", "description", "false nếu ảnh không phải hóa đơn"),
                    "merchant", Map.of("type", "string"),
                    "date", Map.of("type", "string", "description", "YYYY-MM-DD hoặc chuỗi rỗng"),
                    "total", Map.of("type", "integer", "description", "Tổng tiền VND"),
                    "category", Map.of("type", "string", "enum", List.of(
                            "FOOD", "GROCERIES", "TRANSPORT", "SHOPPING", "BILLS",
                            "HEALTH", "ENTERTAINMENT", "EDUCATION", "OTHER")),
                    "items", Map.of("type", "array", "items", Map.of(
                            "type", "object",
                            "properties", Map.of(
                                    "name", Map.of("type", "string"),
                                    "quantity", Map.of("type", "number"),
                                    "price", Map.of("type", "integer", "description", "Thành tiền VND")),
                            "required", List.of("name", "quantity", "price")))),
            "required", List.of("isReceipt", "merchant", "date", "total", "category", "items"));

    private final Client client;
    private final String model;
    private final ObjectMapper json;

    public GeminiReceiptScanner(AppProperties props, ObjectMapper json) {
        AppProperties.Gemini gemini = props.receipt().gemini();
        this.model = gemini.model();
        this.json = json;
        this.client = createClient(gemini);
    }

    private static Client createClient(AppProperties.Gemini gemini) {
        if (gemini.project() == null || gemini.project().isBlank()) {
            log.warn("RECEIPT_PROVIDER=gemini but GCP_PROJECT_ID is empty, receipt scanning disabled");
            return null;
        }
        try {
            return Client.builder()
                    .vertexAI(true)
                    .project(gemini.project())
                    .location(gemini.location())
                    .build();
        } catch (RuntimeException e) {
            // Thường do thiếu/sai file service account, app vẫn chạy và cho nhập tay
            log.error("Cannot create Gemini client, receipt scanning disabled: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public boolean enabled() {
        return client != null;
    }

    @Override
    public Optional<Extracted> scan(byte[] image, String mediaType) {
        if (client == null) return Optional.empty();

        try {
            GenerateContentResponse response = client.models.generateContent(
                    model, buildContent(image, mediaType), buildConfig());
            String text = response.text();
            if (text == null || text.isBlank()) {
                log.warn("Receipt scan returned no text: finishReason={}", response.finishReason());
                return Optional.empty();
            }
            ReceiptData data = json.readValue(text, ReceiptData.class);
            return data.isReceipt() ? Optional.of(ReceiptExtraction.toExtracted(data)) : Optional.empty();
        } catch (ApiException e) {
            log.error("Receipt scan failed: status={} {}", e.code(), e.message());
            return Optional.empty();
        } catch (Exception e) {
            log.error("Receipt scan failed", e);
            return Optional.empty();
        }
    }

    static Content buildContent(byte[] image, String mediaType) {
        String mime = mediaType == null || mediaType.isBlank() ? "image/jpeg" : mediaType.toLowerCase();
        return Content.fromParts(Part.fromBytes(image, mime), Part.fromText(ReceiptExtraction.PROMPT));
    }

    static GenerateContentConfig buildConfig() {
        return GenerateContentConfig.builder()
                .responseMimeType("application/json")
                .responseJsonSchema(RESPONSE_SCHEMA)
                .temperature(0f)
                .maxOutputTokens(8192)
                .build();
    }

    @PreDestroy
    void close() {
        if (client != null) client.close();
    }
}
