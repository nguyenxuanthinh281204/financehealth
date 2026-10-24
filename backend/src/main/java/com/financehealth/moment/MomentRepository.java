package com.financehealth.moment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MomentRepository extends JpaRepository<Moment, Long> {

    List<Moment> findByUserIdAndTakenOnBetweenOrderByTakenOnDescCreatedAtDesc(Long userId, LocalDate from, LocalDate to);

    Optional<Moment> findByIdAndUserId(Long id, Long userId);

    long countByUserIdAndTakenOnBetween(Long userId, LocalDate from, LocalDate to);
}
