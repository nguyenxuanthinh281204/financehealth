package com.financehealth.note;

import com.financehealth.common.CurrentUser;
import com.financehealth.note.NoteDtos.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class NoteController {

    private final NoteService service;

    public NoteController(NoteService service) {
        this.service = service;
    }

    @GetMapping("/notes")
    public NotesBoard board() {
        return service.board(CurrentUser.id());
    }

    @PostMapping("/notes")
    public NoteView create(@Valid @RequestBody CreateNoteRequest req) {
        return service.create(CurrentUser.id(), req);
    }

    @PatchMapping("/notes/{id}")
    public NoteView update(@PathVariable long id, @Valid @RequestBody UpdateNoteRequest req) {
        return service.update(CurrentUser.id(), id, req);
    }

    @PostMapping("/notes/{id}/copy")
    public NoteView copy(@PathVariable long id) {
        return service.copy(CurrentUser.id(), id);
    }

    /** Xóa vĩnh viễn một ghi chú trong thùng rác. */
    @DeleteMapping("/notes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        service.delete(CurrentUser.id(), id);
    }

    @DeleteMapping("/notes/trash")
    public NotesBoard emptyTrash() {
        return service.emptyTrash(CurrentUser.id());
    }

    @PostMapping("/note-labels")
    public NotesBoard createLabel(@Valid @RequestBody LabelRequest req) {
        return service.createLabel(CurrentUser.id(), req);
    }

    @PatchMapping("/note-labels/{id}")
    public NotesBoard renameLabel(@PathVariable long id, @Valid @RequestBody LabelRequest req) {
        return service.renameLabel(CurrentUser.id(), id, req);
    }

    @DeleteMapping("/note-labels/{id}")
    public NotesBoard deleteLabel(@PathVariable long id) {
        return service.deleteLabel(CurrentUser.id(), id);
    }
}
