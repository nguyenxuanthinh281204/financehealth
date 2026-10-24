package com.financehealth.finance.receipt;

import com.financehealth.finance.Expense;
import com.financehealth.finance.ExpenseDtos.LineItem;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ReceiptScanner {

    record Extracted(String merchant, LocalDate date, BigDecimal total, Expense.Category category, List<LineItem> items) {}

    boolean enabled();

    /** Đọc thông tin hóa đơn từ ảnh. Trả về rỗng nếu ảnh không phải hóa đơn hoặc đọc thất bại. */
    Optional<Extracted> scan(byte[] image, String mediaType);
}
