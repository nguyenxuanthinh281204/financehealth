package com.financehealth.vocab;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "vocab_decks")
public class VocabDeck {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(nullable = false)
    private String language;

    @Column(name = "new_per_day", nullable = false)
    private int newPerDay;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected VocabDeck() {}

    public VocabDeck(Long userId, String name, String language, int newPerDay) {
        this.userId = userId;
        this.name = name;
        this.language = language;
        this.newPerDay = newPerDay;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public int getNewPerDay() { return newPerDay; }
    public void setNewPerDay(int newPerDay) { this.newPerDay = newPerDay; }
    public Instant getCreatedAt() { return createdAt; }
}
