package com.financehealth.body;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface WeightLogRepository extends JpaRepository<WeightLog, Long> {

    Optional<WeightLog> findByUserIdAndLogDate(Long userId, LocalDate logDate);

    Optional<WeightLog> findByIdAndUserId(Long id, Long userId);

    List<WeightLog> findByUserIdAndLogDateBetweenOrderByLogDateAsc(Long userId, LocalDate from, LocalDate to);

    Optional<WeightLog> findFirstByUserIdAndLogDateLessThanOrderByLogDateDesc(Long userId, LocalDate before);
}
