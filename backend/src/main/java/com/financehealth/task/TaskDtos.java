package com.financehealth.task;

import jakarta.validation.constraints.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class TaskDtos {

    private TaskDtos() {}

    public record ListRequest(@NotBlank @Size(max = 60) String name) {}

    /** parentId khác null thì tạo việc con, khi đó listId lấy theo việc cha. */
    public record CreateTaskRequest(Long listId, Long parentId, @NotBlank @Size(max = 200) String title,
                                    @Size(max = 2000) String notes, LocalDate dueDate, Boolean starred) {}

    /** Trường nào null thì giữ nguyên. notes rỗng là xóa ghi chú, clearDue = true là bỏ ngày hạn. */
    public record UpdateTaskRequest(@Size(min = 1, max = 200) String title, @Size(max = 2000) String notes,
                                    LocalDate dueDate, Boolean clearDue, Boolean starred, Boolean completed,
                                    Long listId) {}

    /** Thứ tự mới của các việc cùng cấp (cùng danh sách, cùng việc cha). */
    public record ReorderRequest(@NotNull Long listId, Long parentId, @NotEmpty @Size(max = 500) List<Long> ids) {}

    public record ListView(long id, String name) {}

    public record TaskView(long id, long listId, Long parentId, String title, String notes, LocalDate dueDate,
                           boolean starred, boolean completed, Instant completedAt, int position) {}

    /** Toàn bộ danh sách và việc của người dùng; mọi thao tác ghi đều trả lại bản mới nhất. */
    public record Board(LocalDate today, List<ListView> lists, List<TaskView> tasks) {}
}
