package com.financehealth.moment;

import com.financehealth.common.CurrentUser;
import com.financehealth.moment.MomentService.MomentView;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/moments")
public class MomentController {

    private final MomentService service;

    public MomentController(MomentService service) {
        this.service = service;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MomentView upload(@RequestParam("file") MultipartFile file,
                             @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate takenOn,
                             @RequestParam(required = false) Double durationSec,
                             @RequestParam(required = false) String caption) {
        return service.upload(CurrentUser.id(), file, takenOn, durationSec, caption);
    }

    @GetMapping
    public List<MomentView> list(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                 @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.list(CurrentUser.id(), from, to);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        service.delete(CurrentUser.id(), id);
        return ResponseEntity.noContent().build();
    }
}
