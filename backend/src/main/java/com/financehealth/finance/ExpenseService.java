package com.financehealth.finance;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.financehealth.common.ApiException;
import com.financehealth.finance.ExpenseDtos.*;
import com.financehealth.storage.StorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class ExpenseService {

    private final ExpenseRepository expenses;
    private final StorageService storage;
    private final ObjectMapper json;

    public ExpenseService(ExpenseRepository expenses, StorageService storage, ObjectMapper json) {
        this.expenses = expenses;
        this.storage = storage;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public List<ExpenseView> list(long userId, LocalDate from, LocalDate to) {
        return expenses.findByUserIdAndSpentOnBetweenOrderBySpentOnDescIdDesc(userId, from, to)
                .stream().map(this::toView).toList();
    }

    @Transactional
    public ExpenseView create(long userId, ExpenseRequest req) {
        Expense e = new Expense(userId);
        apply(e, req);
        return toView(expenses.save(e));
    }

    @Transactional
    public ExpenseView update(long userId, long id, ExpenseRequest req) {
        Expense e = find(userId, id);
        apply(e, req);
        return toView(e);
    }

    @Transactional
    public void delete(long userId, long id) {
        Expense e = find(userId, id);
        if (e.getReceiptKey() != null) storage.delete(e.getReceiptKey());
        expenses.delete(e);
    }

    private void apply(Expense e, ExpenseRequest req) {
        e.setSpentOn(req.spentOn());
        e.setAmount(req.amount());
        e.setCategory(req.category());
        e.setMerchant(blankToNull(req.merchant()));
        e.setNote(blankToNull(req.note()));
        try {
            e.setItemsJson(req.items() == null || req.items().isEmpty() ? null : json.writeValueAsString(req.items()));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private Expense find(long userId, long id) {
        return expenses.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("khoản chi"));
    }

    private ExpenseView toView(Expense e) {
        List<LineItem> items = List.of();
        if (e.getItemsJson() != null) {
            try {
                items = json.readValue(e.getItemsJson(), new TypeReference<>() {});
            } catch (JsonProcessingException ignored) {
                // dữ liệu cũ hỏng thì bỏ qua danh sách món
            }
        }
        // Ảnh hóa đơn chỉ còn ở các khoản chi cũ (trước khi bỏ tính năng quét), vẫn hiển thị lại
        return new ExpenseView(e.getId(), e.getSpentOn(), e.getAmount(), e.getCategory(), e.getMerchant(), e.getNote(),
                items, e.getReceiptKey() == null ? null : storage.signedUrl(e.getReceiptKey()));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
