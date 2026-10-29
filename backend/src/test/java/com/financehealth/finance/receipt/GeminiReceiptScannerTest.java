package com.financehealth.finance.receipt;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.financehealth.finance.Expense;
import com.financehealth.finance.receipt.ReceiptExtraction.ReceiptData;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class GeminiReceiptScannerTest {

    @Test
    void buildsJsonSchemaRequestWithImage() {
        var config = GeminiReceiptScanner.buildConfig();
        assertThat(config.responseMimeType()).contains("application/json");
        assertThat(config.responseJsonSchema()).contains(GeminiReceiptScanner.RESPONSE_SCHEMA);

        var content = GeminiReceiptScanner.buildContent(new byte[]{1, 2, 3}, "image/PNG");
        String raw = content.toJson();
        assertThat(raw).contains("image/png").contains("hóa đơn");
    }

    @Test
    void parsesGeminiJsonIntoExpense() throws Exception {
        String text = """
                {"isReceipt":true,"merchant":"Highlands","date":"2026-10-27","total":59000,
                 "category":"FOOD","items":[{"name":"Phin sữa đá","quantity":1,"price":59000}]}
                """;
        var data = new ObjectMapper().readValue(text, ReceiptData.class);
        var extracted = ReceiptExtraction.toExtracted(data);
        assertThat(extracted.merchant()).isEqualTo("Highlands");
        assertThat(extracted.date()).isEqualTo(LocalDate.of(2026, 10, 27));
        assertThat(extracted.total()).isEqualByComparingTo(BigDecimal.valueOf(59000));
        assertThat(extracted.category()).isEqualTo(Expense.Category.FOOD);
        assertThat(extracted.items()).hasSize(1);
    }
}
