package com.financehealth.meal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MealPlanRepository extends JpaRepository<MealPlan, Long> {

    Optional<MealPlan> findByUserIdAndPlanDate(Long userId, LocalDate planDate);

    List<MealPlan> findByUserIdAndPlanDateBetween(Long userId, LocalDate from, LocalDate to);

    @Query("select i from MealPlanItem i join i.plan p where i.id = :itemId and p.userId = :userId")
    Optional<MealPlanItem> findItem(@Param("userId") Long userId, @Param("itemId") Long itemId);
}
