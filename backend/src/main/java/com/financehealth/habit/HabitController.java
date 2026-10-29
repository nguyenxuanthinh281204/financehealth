package com.financehealth.habit;

import com.financehealth.common.CurrentUser;
import com.financehealth.habit.HabitDtos.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/habits")
public class HabitController {

    private final HabitService service;

    public HabitController(HabitService service) {
        this.service = service;
    }

    /** Tất cả thói quen kèm trạng thái hôm nay, chuỗi và bản đồ nhiệt 26 tuần. */
    @GetMapping
    public Overview overview() {
        return service.overview(CurrentUser.id());
    }

    @PostMapping
    public HabitView create(@Valid @RequestBody CreateRequest req) {
        return service.create(CurrentUser.id(), req);
    }

    @PatchMapping("/{id}")
    public HabitView update(@PathVariable long id, @Valid @RequestBody UpdateRequest req) {
        return service.update(CurrentUser.id(), id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        service.delete(CurrentUser.id(), id);
        return ResponseEntity.noContent().build();
    }

    /** Tick hoặc bỏ tick một ngày (một bữa với thói quen ăn theo thực đơn). */
    @PutMapping("/{id}/checks")
    public HabitView check(@PathVariable long id, @Valid @RequestBody CheckRequest req) {
        return service.check(CurrentUser.id(), id, req);
    }
}
