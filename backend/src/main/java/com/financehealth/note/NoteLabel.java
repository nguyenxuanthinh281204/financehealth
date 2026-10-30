package com.financehealth.note;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "note_labels")
public class NoteLabel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String name;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected NoteLabel() {}

    public NoteLabel(Long userId, String name) {
        this.userId = userId;
        this.name = name;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
