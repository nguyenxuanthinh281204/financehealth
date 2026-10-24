package com.financehealth.meal;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "meal_plans")
public class MealPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "plan_date", nullable = false)
    private LocalDate planDate;

    @Column(name = "target_kcal", nullable = false) private BigDecimal targetKcal;
    @Column(name = "target_protein", nullable = false) private BigDecimal targetProtein;
    @Column(name = "target_carbs", nullable = false) private BigDecimal targetCarbs;
    @Column(name = "target_fat", nullable = false) private BigDecimal targetFat;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("meal, position")
    private List<MealPlanItem> items = new ArrayList<>();

    protected MealPlan() {}

    public MealPlan(Long userId, LocalDate planDate, BigDecimal kcal, BigDecimal protein,
                    BigDecimal carbs, BigDecimal fat) {
        this.userId = userId;
        this.planDate = planDate;
        this.targetKcal = kcal;
        this.targetProtein = protein;
        this.targetCarbs = carbs;
        this.targetFat = fat;
    }

    public void addItem(MealPlanItem item) {
        item.setPlan(this);
        items.add(item);
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public LocalDate getPlanDate() { return planDate; }
    public BigDecimal getTargetKcal() { return targetKcal; }
    public BigDecimal getTargetProtein() { return targetProtein; }
    public BigDecimal getTargetCarbs() { return targetCarbs; }
    public BigDecimal getTargetFat() { return targetFat; }
    public List<MealPlanItem> getItems() { return items; }
}
