package com.financehealth.body;

import com.financehealth.body.BodyEnums.*;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class MacroCalculatorTest {

    private final MacroCalculator calc = new MacroCalculator();
    private final LocalDate today = LocalDate.of(2026, 10, 24);

    @Test
    void maleModerateMaintain() {
        var r = calc.calculate(new MacroCalculator.Input(Sex.MALE, LocalDate.of(2000, 10, 24), 175, 70,
                ActivityLevel.MODERATE, Goal.MAINTAIN), today);
        // BMR = 700 + 1093.75 - 130 + 5 = 1668.75
        assertThat(r.age()).isEqualTo(26);
        assertThat(r.bmr()).isEqualTo(1669);
        assertThat(r.tdee()).isEqualTo(2587);
        assertThat(r.kcal()).isEqualTo(2587);
        assertThat(r.protein()).isEqualTo(126);
        assertThat(r.fat()).isEqualTo(72);
        // macro cộng lại xấp xỉ tổng calo
        assertThat(r.protein() * 4 + r.carbs() * 4 + r.fat() * 9).isBetween(r.kcal() - 10, r.kcal() + 10);
        assertThat(r.bmi()).isEqualTo(22.9);
        assertThat(r.bmiCategory()).isEqualTo("Bình thường");
    }

    @Test
    void cuttingNeverGoesBelowBmr() {
        var r = calc.calculate(new MacroCalculator.Input(Sex.FEMALE, LocalDate.of(1995, 1, 1), 155, 48,
                ActivityLevel.SEDENTARY, Goal.LOSE), today);
        assertThat(r.kcal()).isGreaterThanOrEqualTo(r.bmr());
        assertThat(r.carbs()).isGreaterThanOrEqualTo(0);
    }

    @Test
    void gainingAddsSurplus() {
        var r = calc.calculate(new MacroCalculator.Input(Sex.MALE, LocalDate.of(2000, 1, 1), 170, 60,
                ActivityLevel.ACTIVE, Goal.GAIN), today);
        assertThat(r.kcal()).isGreaterThan(r.tdee());
    }
}
