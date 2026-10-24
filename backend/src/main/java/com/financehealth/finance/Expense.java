package com.financehealth.finance;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "expenses")
public class Expense {

    public enum Category {
        FOOD, GROCERIES, TRANSPORT, SHOPPING, BILLS, HEALTH, ENTERTAINMENT, EDUCATION, OTHER
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "spent_on", nullable = false)
    private LocalDate spentOn;

    @Column(nullable = false)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Category category;

    private String merchant;

    private String note;

    /** Danh sách món trên hóa đơn dạng JSON, chỉ để hiển thị lại. */
    @Column(name = "items_json")
    private String itemsJson;

    @Column(name = "receipt_key")
    private String receiptKey;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Expense() {}

    public Expense(Long userId) {
        this.userId = userId;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public LocalDate getSpentOn() { return spentOn; }
    public void setSpentOn(LocalDate spentOn) { this.spentOn = spentOn; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }
    public String getMerchant() { return merchant; }
    public void setMerchant(String merchant) { this.merchant = merchant; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getItemsJson() { return itemsJson; }
    public void setItemsJson(String itemsJson) { this.itemsJson = itemsJson; }
    public String getReceiptKey() { return receiptKey; }
    public void setReceiptKey(String receiptKey) { this.receiptKey = receiptKey; }
    public Instant getCreatedAt() { return createdAt; }
}
