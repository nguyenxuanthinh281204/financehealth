package com.financehealth.body;

public final class BodyEnums {

    private BodyEnums() {}

    public enum Sex { MALE, FEMALE }

    public enum ActivityLevel {
        SEDENTARY(1.2),      // ít vận động, ngồi văn phòng
        LIGHT(1.375),        // tập nhẹ 1-3 buổi/tuần
        MODERATE(1.55),      // tập 3-5 buổi/tuần
        ACTIVE(1.725),       // tập nặng 6-7 buổi/tuần
        VERY_ACTIVE(1.9);    // tập 2 buổi/ngày hoặc lao động nặng

        public final double factor;

        ActivityLevel(double factor) {
            this.factor = factor;
        }
    }

    public enum Goal {
        LOSE(-0.20, 2.2),
        MAINTAIN(0.0, 1.8),
        GAIN(0.10, 2.0);

        public final double calorieAdjust;
        public final double proteinPerKg;

        Goal(double calorieAdjust, double proteinPerKg) {
            this.calorieAdjust = calorieAdjust;
            this.proteinPerKg = proteinPerKg;
        }
    }
}
