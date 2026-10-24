package com.financehealth.meal;

import com.financehealth.food.Food;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Entity
@Table(name = "meal_plan_items")
public class MealPlanItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_id")
    private MealPlan plan;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Food.Meal meal;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "food_id")
    private Food food;

    @Column(nullable = false) private int grams;
    @Column(nullable = false) private BigDecimal kcal;
    @Column(nullable = false) private BigDecimal protein;
    @Column(nullable = false) private BigDecimal carbs;
    @Column(nullable = false) private BigDecimal fat;
    @Column(nullable = false) private int position;

    protected MealPlanItem() {}

    public MealPlanItem(Food.Meal meal, Food food, int grams, int position) {
        this.meal = meal;
        this.food = food;
        this.position = position;
        setGrams(grams);
    }

    /** Đổi khối lượng và tính lại dinh dưỡng theo bảng của món. */
    public void setGrams(int grams) {
        this.grams = grams;
        BigDecimal factor = BigDecimal.valueOf(grams).divide(BigDecimal.valueOf(100));
        this.kcal = food.getKcal().multiply(factor).setScale(1, RoundingMode.HALF_UP);
        this.protein = food.getProtein().multiply(factor).setScale(1, RoundingMode.HALF_UP);
        this.carbs = food.getCarbs().multiply(factor).setScale(1, RoundingMode.HALF_UP);
        this.fat = food.getFat().multiply(factor).setScale(1, RoundingMode.HALF_UP);
    }

    void setPlan(MealPlan plan) { this.plan = plan; }

    public Long getId() { return id; }
    public MealPlan getPlan() { return plan; }
    public Food.Meal getMeal() { return meal; }
    public Food getFood() { return food; }
    public int getGrams() { return grams; }
    public BigDecimal getKcal() { return kcal; }
    public BigDecimal getProtein() { return protein; }
    public BigDecimal getCarbs() { return carbs; }
    public BigDecimal getFat() { return fat; }
    public int getPosition() { return position; }
}
