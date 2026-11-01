package com.financehealth.vocab;

import com.financehealth.vocab.Scheduler.Srs;
import com.financehealth.vocab.Scheduler.State;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "vocab_cards")
public class VocabCard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "deck_id", nullable = false)
    private Long deckId;

    @Column(nullable = false)
    private String term;

    @Column(nullable = false)
    private String meaning;

    private String pronunciation;

    private String example;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private State state = State.NEW;

    @Column(nullable = false)
    private int step;

    @Column(name = "interval_days", nullable = false)
    private int intervalDays;

    @Column(name = "ease_factor", nullable = false)
    private int ease = Scheduler.START_EASE;

    @Column(nullable = false)
    private int reps;

    @Column(nullable = false)
    private int lapses;

    @Column(name = "due_at")
    private Instant dueAt;

    @Column(name = "last_reviewed_at")
    private Instant lastReviewedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected VocabCard() {}

    public VocabCard(Long userId, Long deckId, String term, String meaning) {
        this.userId = userId;
        this.deckId = deckId;
        this.term = term;
        this.meaning = meaning;
    }

    public Srs srs() {
        return new Srs(state, step, intervalDays, ease, reps, lapses, dueAt);
    }

    public void apply(Srs s, Instant reviewedAt) {
        state = s.state();
        step = s.step();
        intervalDays = s.intervalDays();
        ease = s.ease();
        reps = s.reps();
        lapses = s.lapses();
        dueAt = s.dueAt();
        lastReviewedAt = reviewedAt;
    }

    /** Quên hết tiến độ, quay về thẻ mới. */
    public void reset() {
        apply(Srs.fresh(), null);
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Long getDeckId() { return deckId; }
    public void setDeckId(Long deckId) { this.deckId = deckId; }
    public String getTerm() { return term; }
    public void setTerm(String term) { this.term = term; }
    public String getMeaning() { return meaning; }
    public void setMeaning(String meaning) { this.meaning = meaning; }
    public String getPronunciation() { return pronunciation; }
    public void setPronunciation(String pronunciation) { this.pronunciation = pronunciation; }
    public String getExample() { return example; }
    public void setExample(String example) { this.example = example; }
    public State getState() { return state; }
    public int getIntervalDays() { return intervalDays; }
    public int getEase() { return ease; }
    public int getReps() { return reps; }
    public int getLapses() { return lapses; }
    public Instant getDueAt() { return dueAt; }
    public Instant getLastReviewedAt() { return lastReviewedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
