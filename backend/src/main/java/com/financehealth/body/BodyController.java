package com.financehealth.body;

import com.financehealth.body.BodyDtos.*;
import com.financehealth.common.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/body")
public class BodyController {

    private final BodyService body;

    public BodyController(BodyService body) {
        this.body = body;
    }

    @GetMapping("/profile")
    public ResponseEntity<ProfileView> profile() {
        return body.getProfile(CurrentUser.id()).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping("/profile")
    public ProfileView saveProfile(@Valid @RequestBody ProfileRequest req) {
        return body.saveProfile(CurrentUser.id(), req);
    }

    @GetMapping("/weights")
    public List<WeightLogView> weights(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return body.listWeights(CurrentUser.id(), from, to);
    }

    @PostMapping("/weights")
    public WeightLogView logWeight(@Valid @RequestBody WeightLogRequest req) {
        return body.logWeight(CurrentUser.id(), req);
    }

    @DeleteMapping("/weights/{id}")
    public ResponseEntity<Void> deleteWeight(@PathVariable long id) {
        body.deleteWeight(CurrentUser.id(), id);
        return ResponseEntity.noContent().build();
    }
}
