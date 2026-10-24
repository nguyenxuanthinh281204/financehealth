package com.financehealth.finance;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.financehealth.common.ApiException;
import com.financehealth.finance.ExpenseDtos.*;
import com.financehealth.finance.receipt.ReceiptScanner;
import com.financehealth.storage.StorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ExpenseService {

    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");

    private final ExpenseRepository expenses;
    private final ReceiptScanner scanner;
    private final StorageService storage;
    private final ObjectMapper json;

    public ExpenseService(ExpenseRepository expenses, ReceiptScanner scanner, StorageService storage, ObjectMapper json) {
        this.expenses = expenses;
        this.scanner = scanner;
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
        apply(userId, e, req);
        return toView(expenses.save(e));
    }

    @Transactional
    public ExpenseView update(long userId, long id, ExpenseRequest req) {
        Expense e = find(userId, id);
        apply(userId, e, req);
        return toView(e);
    }

    @Transactional
    public void delete(long userId, long id) {
        Expense e = find(userId, id);
        if (e.getReceiptKey() != null) storage.delete(e.getReceiptKey());
        expenses.delete(e);
    }

    /** Lưu ảnh hóa đơn rồi cho AI đọc thông tin để điền sẵn form. Chưa tạo khoản chi. */
    public ScanResult scanReceipt(long userId, MultipartFile file) {
        String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (!IMAGE_TYPES.contains(type)) throw ApiException.badRequest("Chỉ hỗ trợ ảnh JPG, PNG, WEBP");

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
        String key = "receipts/" + userId + "/" + UUID.randomUUID() + extension(type);
        try {
            storage.put(key, new java.io.ByteArrayInputStream(bytes), bytes.length, type);
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
        String url = storage.signedUrl(key);

        if (!scanner.enabled()) {
            return new ScanResult(false, key, url, null, null, null, null, List.of(),
                    "Chưa bật quét hóa đơn tự động. Ảnh đã được lưu, bạn nhập thông tin giúp nhé.");
        }
        return scanner.scan(bytes, type)
                .map(x -> new ScanResult(true, key, url, x.merchant(), x.date(), x.total(), x.category(), x.items(), null))
                .orElseGet(() -> new ScanResult(true, key, url, null, null, null, null, List.of(),
                        "Không đọc được hóa đơn. Bạn thử chụp rõ hơn hoặc nhập tay."));
    }

    private void apply(long userId, Expense e, ExpenseRequest req) {
        if (req.receiptKey() != null && !req.receiptKey().startsWith("receipts/" + userId + "/")) {
            throw ApiException.badRequest("Ảnh hóa đơn không hợp lệ");
        }
        e.setSpentOn(req.spentOn());
        e.setAmount(req.amount());
        e.setCategory(req.category());
        e.setMerchant(blankToNull(req.merchant()));
        e.setNote(blankToNull(req.note()));
        e.setReceiptKey(req.receiptKey());
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
        return new ExpenseView(e.getId(), e.getSpentOn(), e.getAmount(), e.getCategory(), e.getMerchant(), e.getNote(),
                items, e.getReceiptKey() == null ? null : storage.signedUrl(e.getReceiptKey()));
    }

    private static String extension(String type) {
        return switch (type) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            default -> ".jpg";
        };
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
