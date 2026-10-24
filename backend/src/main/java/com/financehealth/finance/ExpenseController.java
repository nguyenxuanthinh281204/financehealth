package com.financehealth.finance;

import com.financehealth.common.CurrentUser;
import com.financehealth.finance.ExpenseDtos.*;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    private final ExpenseService service;

    public ExpenseController(ExpenseService service) {
        this.service = service;
    }

    @GetMapping
    public List<ExpenseView> list(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                  @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.list(CurrentUser.id(), from, to);
    }

    @PostMapping
    public ExpenseView create(@Valid @RequestBody ExpenseRequest req) {
        return service.create(CurrentUser.id(), req);
    }

    @PutMapping("/{id}")
    public ExpenseView update(@PathVariable long id, @Valid @RequestBody ExpenseRequest req) {
        return service.update(CurrentUser.id(), id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        service.delete(CurrentUser.id(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/scan-receipt", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ScanResult scan(@RequestParam("file") MultipartFile file) {
        return service.scanReceipt(CurrentUser.id(), file);
    }
}
