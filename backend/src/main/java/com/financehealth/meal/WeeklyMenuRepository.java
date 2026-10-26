package com.financehealth.meal;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;

public interface WeeklyMenuRepository extends JpaRepository<WeeklyMenu, Long> {

    boolean existsByUserIdAndWeekStart(Long userId, LocalDate weekStart);
}
