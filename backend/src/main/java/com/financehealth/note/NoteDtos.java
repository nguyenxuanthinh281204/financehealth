package com.financehealth.note;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;

public final class NoteDtos {

    private NoteDtos() {}

    public record ItemDto(@Size(max = 40) String id, @NotNull @Size(max = 1000) String text, boolean checked) {}

    /** Tạo ghi chú mới; ghi chú trống hoàn toàn bị từ chối (giống Keep: đóng ô trống là không lưu). */
    public record CreateNoteRequest(@Size(max = 200) String title, @Size(max = 20000) String body, Boolean checklist,
                                    @Size(max = 200) List<@Valid ItemDto> items, String color, Boolean pinned,
                                    Boolean archived, @Size(max = 20) List<Long> labelIds) {}

    /** Trường nào null thì giữ nguyên. */
    public record UpdateNoteRequest(@Size(max = 200) String title, @Size(max = 20000) String body, Boolean checklist,
                                    @Size(max = 200) List<@Valid ItemDto> items, String color, Boolean pinned,
                                    Boolean archived, Boolean trashed, @Size(max = 20) List<Long> labelIds) {}

    public record LabelRequest(@NotBlank @Size(max = 50) String name) {}

    public record LabelView(long id, String name) {}

    public record NoteView(long id, String title, String body, boolean checklist, List<ItemDto> items, String color,
                           boolean pinned, boolean archived, Instant trashedAt, long position, List<Long> labelIds,
                           Instant createdAt, Instant updatedAt) {}

    /** Toàn bộ nhãn và ghi chú (kể cả lưu trữ, thùng rác); máy khách tự lọc theo màn đang xem. */
    public record NotesBoard(List<LabelView> labels, List<NoteView> notes) {}
}
