package com.financehealth.meal;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

/** Đánh dấu tuần đã tạo thực đơn, để mỗi tuần chỉ tạo một lần. */
@Entity
@Table(name = "weekly_menus")
public class WeeklyMenu {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected WeeklyMenu() {}

    public WeeklyMenu(Long userId, LocalDate weekStart) {
        this.userId = userId;
        this.weekStart = weekStart;
    }

    public Long getId() { return id; }
    public LocalDate getWeekStart() { return weekStart; }
}
