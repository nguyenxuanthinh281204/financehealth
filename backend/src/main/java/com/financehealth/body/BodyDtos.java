package com.financehealth.body;

import com.financehealth.body.BodyEnums.*;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public final class BodyDtos {

    private BodyDtos() {}

    public record ProfileRequest(
            @NotNull Sex sex,
            @NotNull @Past LocalDate birthDate,
            @NotNull @DecimalMin("100") @DecimalMax("250") BigDecimal heightCm,
            @NotNull @DecimalMin("25") @DecimalMax("300") BigDecimal weightKg,
            @NotNull ActivityLevel activityLevel,
            @NotNull Goal goal,
            @DecimalMin("25") @DecimalMax("300") BigDecimal targetWeightKg) {}

    public record ProfileView(Sex sex, LocalDate birthDate, BigDecimal heightCm, BigDecimal weightKg,
                              ActivityLevel activityLevel, Goal goal, BigDecimal targetWeightKg,
                              MacroCalculator.Result macros) {}

    public record WeightLogRequest(
            @NotNull LocalDate logDate,
            @NotNull @DecimalMin("25") @DecimalMax("300") BigDecimal weightKg,
            @DecimalMin("2") @DecimalMax("70") BigDecimal bodyFatPct,
            @Size(max = 255) String note) {}

    public record WeightLogView(long id, LocalDate logDate, BigDecimal weightKg, BigDecimal bodyFatPct, String note) {
        static WeightLogView of(WeightLog w) {
            return new WeightLogView(w.getId(), w.getLogDate(), w.getWeightKg(), w.getBodyFatPct(), w.getNote());
        }
    }
}
