package com.financehealth.finance.receipt;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import com.financehealth.finance.Expense;
import com.financehealth.finance.ExpenseDtos.LineItem;
import com.financehealth.finance.receipt.ReceiptScanner.Extracted;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

/** Prompt và kiểu dữ liệu trả về dùng chung cho mọi nhà cung cấp AI đọc hóa đơn. */
public final class ReceiptExtraction {

    static final String PROMPT = """
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

    private ReceiptExtraction() {}

    static Extracted toExtracted(ReceiptData d) {
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
}
