package com.financehealth.note;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "notes")
public class Note {

    /** Một dòng của ghi chú dạng danh sách; id do máy khách tạo để giữ vị trí con trỏ khi sửa. */
    public record Item(String id, String text, boolean checked) {}

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String title = "";

    @Column(nullable = false)
    private String body = "";

    @Column(nullable = false)
    private boolean checklist;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<Item> items = new ArrayList<>();

    @Column(nullable = false)
    private String color = NoteService.DEFAULT_COLOR;

    @Column(nullable = false)
    private boolean pinned;

    @Column(nullable = false)
    private boolean archived;

    @Column(name = "trashed_at")
    private Instant trashedAt;

    @Column(nullable = false)
    private long position;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = createdAt;

    protected Note() {}

    public Note(Long userId, long position) {
        this.userId = userId;
        this.position = position;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public boolean isChecklist() { return checklist; }
    public void setChecklist(boolean checklist) { this.checklist = checklist; }
    public List<Item> getItems() { return items; }
    public void setItems(List<Item> items) { this.items = new ArrayList<>(items); }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public boolean isPinned() { return pinned; }
    public void setPinned(boolean pinned) { this.pinned = pinned; }
    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }
    public Instant getTrashedAt() { return trashedAt; }
    public boolean isTrashed() { return trashedAt != null; }
    public long getPosition() { return position; }
    public void setPosition(long position) { this.position = position; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void touch() { updatedAt = now(); }

    public void setTrashed(boolean trashed) {
        if (trashed && trashedAt == null) trashedAt = now();
        if (!trashed) trashedAt = null;
    }

    /** Postgres lưu tới micro giây; cắt sẵn để giá trị trả về khớp với lần đọc lại sau. */
    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }
}
