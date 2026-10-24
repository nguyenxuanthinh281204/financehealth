package com.financehealth.food;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface FoodRepository extends JpaRepository<Food, Long> {

    @Query("select f from Food f where (f.ownerId is null or f.ownerId = :userId) order by f.category, f.name")
    List<Food> findVisible(@Param("userId") Long userId);

    @Query("select f from Food f where f.id in :ids and (f.ownerId is null or f.ownerId = :userId)")
    List<Food> findVisibleByIds(@Param("userId") Long userId, @Param("ids") Collection<Long> ids);

    Optional<Food> findByIdAndOwnerId(Long id, Long ownerId);
}
