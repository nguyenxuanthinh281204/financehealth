package com.financehealth.body;

import com.financehealth.body.BodyEnums.*;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.Period;

/**
 * Tính BMR theo Mifflin-St Jeor, nhân hệ số vận động ra TDEE, rồi điều chỉnh theo mục tiêu.
 * Protein theo g/kg cân nặng, fat 25% tổng năng lượng (tối thiểu 0.6 g/kg), còn lại là carb.
 */
@Component
public class MacroCalculator {

    public record Input(Sex sex, LocalDate birthDate, double heightCm, double weightKg,
                        ActivityLevel activity, Goal goal) {}

    public record Result(int age, double bmi, String bmiCategory, int bmr, int tdee,
                         int kcal, int protein, int carbs, int fat, int waterMl) {}

    public Result calculate(Input in, LocalDate today) {
        int age = Period.between(in.birthDate(), today).getYears();
        double bmrRaw = 10 * in.weightKg() + 6.25 * in.heightCm() - 5 * age + (in.sex() == Sex.MALE ? 5 : -161);
        double tdee = bmrRaw * in.activity().factor;
        // Không cắt calo xuống dưới BMR để tránh thiếu chất
        double kcal = Math.max(tdee * (1 + in.goal().calorieAdjust), Math.min(bmrRaw, tdee));

        double protein = in.weightKg() * in.goal().proteinPerKg;
        double fat = Math.max(kcal * 0.25 / 9, in.weightKg() * 0.6);
        double carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);

        double heightM = in.heightCm() / 100;
        double bmi = in.weightKg() / (heightM * heightM);

        return new Result(age, Math.round(bmi * 10) / 10.0, bmiCategory(bmi),
                (int) Math.round(bmrRaw), (int) Math.round(tdee), (int) Math.round(kcal),
                (int) Math.round(protein), (int) Math.round(carbs), (int) Math.round(fat),
                (int) Math.round(in.weightKg() * 35));
    }

    /** Ngưỡng BMI cho người châu Á (WHO khu vực Tây Thái Bình Dương). */
    static String bmiCategory(double bmi) {
        if (bmi < 18.5) return "Thiếu cân";
        if (bmi < 23) return "Bình thường";
        if (bmi < 25) return "Thừa cân";
        if (bmi < 30) return "Béo phì độ I";
        return "Béo phì độ II";
    }
}
