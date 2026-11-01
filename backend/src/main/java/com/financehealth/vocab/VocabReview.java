package com.financehealth.vocab;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "vocab_reviews")
public class VocabReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "card_id", nullable = false)
    private Long cardId;

    @Column(nullable = false)
    private short rating;

    @Column(name = "was_new", nullable = false)
    private boolean wasNew;

    @Column(name = "interval_days", nullable = false)
    private int intervalDays;

    @Column(name = "reviewed_at", nullable = false)
    private Instant reviewedAt;

    protected VocabReview() {}

    public VocabReview(Long userId, Long cardId, int rating, boolean wasNew, int intervalDays, Instant reviewedAt) {
        this.userId = userId;
        this.cardId = cardId;
        this.rating = (short) rating;
        this.wasNew = wasNew;
        this.intervalDays = intervalDays;
        this.reviewedAt = reviewedAt;
    }
}
