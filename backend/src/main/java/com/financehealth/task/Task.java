package com.financehealth.task;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "list_id", nullable = false)
    private Long listId;

    /** null với việc chính. */
    @Column(name = "parent_id")
    private Long parentId;

    @Column(nullable = false)
    private String title;

    private String notes;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(nullable = false)
    private boolean starred;

    @Column(nullable = false)
    private int position;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Task() {}

    public Task(Long userId, Long listId, Long parentId, String title, int position) {
        this.userId = userId;
        this.listId = listId;
        this.parentId = parentId;
        this.title = title;
        this.position = position;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Long getListId() { return listId; }
    public void setListId(Long listId) { this.listId = listId; }
    public Long getParentId() { return parentId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public boolean isStarred() { return starred; }
    public void setStarred(boolean starred) { this.starred = starred; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public Instant getCompletedAt() { return completedAt; }
    public boolean isCompleted() { return completedAt != null; }

    public void setCompleted(boolean completed) {
        if (completed && completedAt == null) completedAt = Instant.now();
        if (!completed) completedAt = null;
    }
}
