package com.financehealth.finance;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class ExpenseDtos {

    private ExpenseDtos() {}

    public record LineItem(@NotBlank @Size(max = 150) String name,
                           @DecimalMin("0") BigDecimal quantity,
                           @DecimalMin("0") BigDecimal price) {}

    public record ExpenseRequest(
            @NotNull LocalDate spentOn,
            @NotNull @DecimalMin("0") @DecimalMax("9999999999999") BigDecimal amount,
            @NotNull Expense.Category category,
            @Size(max = 150) String merchant,
            @Size(max = 500) String note,
            @Size(max = 100) List<@Valid LineItem> items,
            @Size(max = 255) String receiptKey) {}

    public record ExpenseView(long id, LocalDate spentOn, BigDecimal amount, Expense.Category category,
                              String merchant, String note, List<LineItem> items, String receiptUrl) {}

    public record ScanResult(boolean enabled, String receiptKey, String receiptUrl, String merchant,
                             LocalDate date, BigDecimal total, Expense.Category category,
                             List<LineItem> items, String message) {}
}
