package com.financehealth.finance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    List<Expense> findByUserIdAndSpentOnBetweenOrderBySpentOnDescIdDesc(Long userId, LocalDate from, LocalDate to);

    Optional<Expense> findByIdAndUserId(Long id, Long userId);
}
