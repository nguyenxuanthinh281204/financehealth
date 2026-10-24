package com.financehealth.food;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

@Entity
@Table(name = "foods")
public class Food {

    public enum Category { PROTEIN, CARB, FAT, VEGGIE, FRUIT, DAIRY, OTHER }

    public enum Meal { BREAKFAST, LUNCH, DINNER }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** null = món có sẵn của hệ thống, dùng chung cho mọi người */
    @Column(name = "owner_id")
    private Long ownerId;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Category category;

    // Giá trị trên 100g
    @Column(nullable = false) private BigDecimal kcal;
    @Column(nullable = false) private BigDecimal protein;
    @Column(nullable = false) private BigDecimal carbs;
    @Column(nullable = false) private BigDecimal fat;

    @Column(name = "default_serving_g", nullable = false) private int defaultServingG;
    @Column(name = "min_g", nullable = false) private int minG;
    @Column(name = "max_g", nullable = false) private int maxG;

    @Column(name = "meal_tags", nullable = false)
    private String mealTags;

    protected Food() {}

    public Food(Long ownerId, String name, Category category, BigDecimal kcal, BigDecimal protein,
                BigDecimal carbs, BigDecimal fat, int defaultServingG, int minG, int maxG, Set<Meal> meals) {
        this.ownerId = ownerId;
        this.name = name;
        this.category = category;
        this.kcal = kcal;
        this.protein = protein;
        this.carbs = carbs;
        this.fat = fat;
        this.defaultServingG = defaultServingG;
        this.minG = minG;
        this.maxG = maxG;
        this.mealTags = meals.stream().map(Enum::name).collect(Collectors.joining(","));
    }

    public Set<Meal> meals() {
        if (mealTags == null || mealTags.isBlank()) return EnumSet.allOf(Meal.class);
        return Arrays.stream(mealTags.split(",")).map(String::trim).map(Meal::valueOf)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(Meal.class)));
    }

    public Long getId() { return id; }
    public Long getOwnerId() { return ownerId; }
    public String getName() { return name; }
    public Category getCategory() { return category; }
    public BigDecimal getKcal() { return kcal; }
    public BigDecimal getProtein() { return protein; }
    public BigDecimal getCarbs() { return carbs; }
    public BigDecimal getFat() { return fat; }
    public int getDefaultServingG() { return defaultServingG; }
    public int getMinG() { return minG; }
    public int getMaxG() { return maxG; }
}
