package com.financehealth.body;

import com.financehealth.body.BodyDtos.*;
import com.financehealth.common.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

@Service
public class BodyService {

    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final BodyProfileRepository profiles;
    private final WeightLogRepository weights;
    private final MacroCalculator calculator;

    public BodyService(BodyProfileRepository profiles, WeightLogRepository weights, MacroCalculator calculator) {
        this.profiles = profiles;
        this.weights = weights;
        this.calculator = calculator;
    }

    @Transactional(readOnly = true)
    public Optional<ProfileView> getProfile(long userId) {
        return profiles.findById(userId).map(this::toView);
    }

    @Transactional
    public ProfileView saveProfile(long userId, ProfileRequest req) {
        BodyProfile p = profiles.findById(userId).orElseGet(() -> new BodyProfile(userId));
        p.setSex(req.sex());
        p.setBirthDate(req.birthDate());
        p.setHeightCm(req.heightCm());
        p.setWeightKg(req.weightKg());
        p.setActivityLevel(req.activityLevel());
        p.setGoal(req.goal());
        p.setTargetWeightKg(req.targetWeightKg());
        p.touch();
        profiles.save(p);
        upsertWeight(userId, new WeightLogRequest(LocalDate.now(ZONE), req.weightKg(), null, null), false);
        return toView(p);
    }

    /** Mục tiêu macro hiện tại; ném lỗi nếu người dùng chưa khai báo chỉ số cơ thể. */
    @Transactional(readOnly = true)
    public MacroCalculator.Result requireMacros(long userId) {
        return profiles.findById(userId).map(this::macrosOf)
                .orElseThrow(() -> ApiException.badRequest("Hãy nhập chỉ số cơ thể trước để hệ thống tính macro"));
    }

    @Transactional(readOnly = true)
    public List<WeightLogView> listWeights(long userId, LocalDate from, LocalDate to) {
        return weights.findByUserIdAndLogDateBetweenOrderByLogDateAsc(userId, from, to)
                .stream().map(WeightLogView::of).toList();
    }

    @Transactional
    public WeightLogView logWeight(long userId, WeightLogRequest req) {
        return upsertWeight(userId, req, true);
    }

    @Transactional
    public void deleteWeight(long userId, long id) {
        WeightLog w = weights.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("bản ghi cân nặng"));
        weights.delete(w);
    }

    private WeightLogView upsertWeight(long userId, WeightLogRequest req, boolean syncProfile) {
        WeightLog w = weights.findByUserIdAndLogDate(userId, req.logDate())
                .orElseGet(() -> new WeightLog(userId, req.logDate()));
        w.setWeightKg(req.weightKg());
        if (req.bodyFatPct() != null) w.setBodyFatPct(req.bodyFatPct());
        if (req.note() != null) w.setNote(req.note());
        weights.save(w);

        // Cân nặng mới nhất được dùng để tính lại macro
        if (syncProfile && !req.logDate().isBefore(LocalDate.now(ZONE))) {
            profiles.findById(userId).ifPresent(p -> {
                p.setWeightKg(req.weightKg());
                p.touch();
            });
        }
        return WeightLogView.of(w);
    }

    private MacroCalculator.Result macrosOf(BodyProfile p) {
        return calculator.calculate(new MacroCalculator.Input(p.getSex(), p.getBirthDate(),
                p.getHeightCm().doubleValue(), p.getWeightKg().doubleValue(),
                p.getActivityLevel(), p.getGoal()), LocalDate.now(ZONE));
    }

    private ProfileView toView(BodyProfile p) {
        return new ProfileView(p.getSex(), p.getBirthDate(), p.getHeightCm(), p.getWeightKg(),
                p.getActivityLevel(), p.getGoal(), p.getTargetWeightKg(), macrosOf(p));
    }
}
