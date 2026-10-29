package com.financehealth.habit;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "habits")
public class Habit {

    /** EXPENSE, MOMENT, WEIGHT tự đánh dấu từ dữ liệu sẵn có; MEAL và CUSTOM tick tay. */
    public enum Kind {
        EXPENSE, MOMENT, WEIGHT, MEAL, CUSTOM;

        public boolean auto() {
            return this == EXPENSE || this == MOMENT || this == WEIGHT;
        }
    }

    /** WEEKLY: xong khi có ít nhất một ngày đạt trong tuần (thứ Hai đến Chủ nhật). */
    public enum Frequency { DAILY, WEEKLY }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Kind kind;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String emoji;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Frequency frequency;

    @Column(name = "daily_target", nullable = false)
    private short dailyTarget = 1;

    @Column(nullable = false)
    private int position;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private boolean archived;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Habit() {}

    public Habit(Long userId, Kind kind, String name, String emoji, Frequency frequency, int dailyTarget,
                 int position, LocalDate startDate) {
        this.userId = userId;
        this.kind = kind;
        this.name = name;
        this.emoji = emoji;
        this.frequency = frequency;
        this.dailyTarget = (short) dailyTarget;
        this.position = position;
        this.startDate = startDate;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Kind getKind() { return kind; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }
    public Frequency getFrequency() { return frequency; }
    public void setFrequency(Frequency frequency) { this.frequency = frequency; }
    public int getDailyTarget() { return dailyTarget; }
    public int getPosition() { return position; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }
}
