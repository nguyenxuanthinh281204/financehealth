package com.financehealth.task;

import com.financehealth.common.CurrentUser;
import com.financehealth.task.TaskDtos.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class TaskController {

    private final TaskService service;

    public TaskController(TaskService service) {
        this.service = service;
    }

    /** Tất cả danh sách và việc; lần đầu tự tạo danh sách "Việc của tôi". */
    @GetMapping("/tasks")
    public Board board() {
        return service.board(CurrentUser.id());
    }

    @PostMapping("/tasks")
    public Board createTask(@Valid @RequestBody CreateTaskRequest req) {
        return service.createTask(CurrentUser.id(), req);
    }

    @PatchMapping("/tasks/{id}")
    public Board updateTask(@PathVariable long id, @Valid @RequestBody UpdateTaskRequest req) {
        return service.updateTask(CurrentUser.id(), id, req);
    }

    @DeleteMapping("/tasks/{id}")
    public Board deleteTask(@PathVariable long id) {
        return service.deleteTask(CurrentUser.id(), id);
    }

    @PutMapping("/tasks/order")
    public Board reorder(@Valid @RequestBody ReorderRequest req) {
        return service.reorder(CurrentUser.id(), req);
    }

    @PostMapping("/task-lists")
    public Board createList(@Valid @RequestBody ListRequest req) {
        return service.createList(CurrentUser.id(), req);
    }

    @PatchMapping("/task-lists/{id}")
    public Board renameList(@PathVariable long id, @Valid @RequestBody ListRequest req) {
        return service.renameList(CurrentUser.id(), id, req);
    }

    @DeleteMapping("/task-lists/{id}")
    public Board deleteList(@PathVariable long id) {
        return service.deleteList(CurrentUser.id(), id);
    }

    /** Xóa hết việc đã hoàn thành trong danh sách. */
    @DeleteMapping("/task-lists/{id}/completed")
    public Board clearCompleted(@PathVariable long id) {
        return service.clearCompleted(CurrentUser.id(), id);
    }
}
