package com.financehealth.note;

import com.financehealth.common.ApiException;
import com.financehealth.note.NoteDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class NoteService {

    static final String DEFAULT_COLOR = "default";
    static final Set<String> COLORS = Set.of(DEFAULT_COLOR, "red", "orange", "yellow", "green", "teal", "blue",
            "darkblue", "purple", "pink", "brown", "gray");
    static final Duration TRASH_TTL = Duration.ofDays(7);
    static final int MAX_LABELS = 50;

    private final NoteRepository notes;
    private final NoteLabelRepository labels;

    public NoteService(NoteRepository notes, NoteLabelRepository labels) {
        this.notes = notes;
        this.labels = labels;
    }

    /** Lấy tất cả; đồng thời xóa hẳn ghi chú nằm trong thùng rác quá 7 ngày. */
    @Transactional
    public NotesBoard board(long userId) {
        notes.purgeTrashed(userId, Instant.now().minus(TRASH_TTL));
        return snapshot(userId);
    }

    @Transactional
    public NoteView create(long userId, CreateNoteRequest req) {
        Note note = new Note(userId, notes.minPosition(userId) - 1);
        note.setTitle(strip(req.title()));
        note.setBody(trimEnd(req.body()));
        note.setChecklist(Boolean.TRUE.equals(req.checklist()));
        note.setItems(toItems(req.items()));
        note.setColor(color(req.color()));
        note.setArchived(Boolean.TRUE.equals(req.archived()));
        // Ghi chú lưu trữ không ghim được (giống Keep)
        note.setPinned(Boolean.TRUE.equals(req.pinned()) && !note.isArchived());
        if (isEmpty(note) && (req.labelIds() == null || req.labelIds().isEmpty())) {
            throw ApiException.badRequest("Ghi chú trống");
        }
        notes.saveAndFlush(note);
        if (req.labelIds() != null) setLabels(userId, note, req.labelIds());
        return view(note, notes.labelIdsOf(note.getId()));
    }

    @Transactional
    public NoteView update(long userId, long id, UpdateNoteRequest req) {
        Note note = find(userId, id);
        boolean trashedBefore = note.isTrashed();
        if (req.trashed() != null) note.setTrashed(req.trashed());
        // Trong thùng rác chỉ được khôi phục, không sửa nội dung
        if (trashedBefore && note.isTrashed()) throw ApiException.badRequest("Không sửa được ghi chú trong thùng rác");
        if (req.title() != null) note.setTitle(strip(req.title()));
        if (req.body() != null) note.setBody(trimEnd(req.body()));
        if (req.checklist() != null) note.setChecklist(req.checklist());
        if (req.items() != null) note.setItems(toItems(req.items()));
        if (req.color() != null) note.setColor(color(req.color()));
        if (req.archived() != null) {
            note.setArchived(req.archived());
            if (req.archived()) note.setPinned(false);
        }
        if (req.pinned() != null) {
            note.setPinned(req.pinned());
            // Ghim một ghi chú đang lưu trữ thì đưa nó ra ngoài
            if (req.pinned()) note.setArchived(false);
        }
        if (req.labelIds() != null) setLabels(userId, note, req.labelIds());
        // "Đã chỉnh sửa lúc..." chỉ tính khi đổi nội dung, không tính ghim/màu/lưu trữ
        if (req.title() != null || req.body() != null || req.checklist() != null || req.items() != null) note.touch();
        notes.flush();
        return view(note, notes.labelIdsOf(note.getId()));
    }

    /** Tạo bản sao (Keep: "Tạo bản sao"), đặt ngay trên bản gốc ở đầu danh sách. */
    @Transactional
    public NoteView copy(long userId, long id) {
        Note src = find(userId, id);
        if (src.isTrashed()) throw ApiException.badRequest("Không sao chép được ghi chú trong thùng rác");
        Note note = new Note(userId, notes.minPosition(userId) - 1);
        note.setTitle(src.getTitle());
        note.setBody(src.getBody());
        note.setChecklist(src.isChecklist());
        note.setItems(src.getItems());
        note.setColor(src.getColor());
        note.setArchived(src.isArchived());
        notes.saveAndFlush(note);
        List<Long> labelIds = notes.labelIdsOf(src.getId());
        labelIds.forEach(l -> notes.addLabel(note.getId(), l));
        return view(note, labelIds);
    }

    /** Xóa vĩnh viễn; chỉ áp dụng cho ghi chú đã ở thùng rác. */
    @Transactional
    public void delete(long userId, long id) {
        Note note = find(userId, id);
        if (!note.isTrashed()) throw ApiException.badRequest("Chuyển ghi chú vào thùng rác trước");
        notes.delete(note);
    }

    @Transactional
    public NotesBoard emptyTrash(long userId) {
        notes.emptyTrash(userId);
        return snapshot(userId);
    }

    @Transactional
    public NotesBoard createLabel(long userId, LabelRequest req) {
        String name = req.name().strip();
        if (labels.countByUserId(userId) >= MAX_LABELS) throw ApiException.badRequest("Tối đa " + MAX_LABELS + " nhãn");
        if (labels.existsByUserIdAndNameIgnoreCase(userId, name)) throw ApiException.badRequest("Nhãn này đã có");
        labels.save(new NoteLabel(userId, name));
        return snapshot(userId);
    }

    @Transactional
    public NotesBoard renameLabel(long userId, long id, LabelRequest req) {
        NoteLabel label = findLabel(userId, id);
        String name = req.name().strip();
        if (!label.getName().equalsIgnoreCase(name) && labels.existsByUserIdAndNameIgnoreCase(userId, name)) {
            throw ApiException.badRequest("Nhãn này đã có");
        }
        label.setName(name);
        return snapshot(userId);
    }

    /** Xóa nhãn, ghi chú vẫn giữ nguyên. */
    @Transactional
    public NotesBoard deleteLabel(long userId, long id) {
        labels.delete(findLabel(userId, id));
        return snapshot(userId);
    }

    private void setLabels(long userId, Note note, List<Long> labelIds) {
        Set<Long> wanted = new LinkedHashSet<>(labelIds);
        if (labels.findByUserIdAndIdIn(userId, wanted).size() != wanted.size()) throw ApiException.notFound("nhãn");
        notes.clearLabels(note.getId());
        wanted.forEach(l -> notes.addLabel(note.getId(), l));
    }

    private NotesBoard snapshot(long userId) {
        notes.flush();
        Map<Long, List<Long>> links = new HashMap<>();
        for (Object[] row : notes.labelLinks(userId)) {
            links.computeIfAbsent(((Number) row[0]).longValue(), k -> new ArrayList<>()).add(((Number) row[1]).longValue());
        }
        links.values().forEach(Collections::sort);
        List<LabelView> labelViews = labels.findByUserIdOrderByNameAsc(userId).stream()
                .map(l -> new LabelView(l.getId(), l.getName())).toList();
        List<NoteView> noteViews = notes.findByUserIdOrderByPositionAscIdDesc(userId).stream()
                .map(n -> view(n, links.getOrDefault(n.getId(), List.of()))).toList();
        return new NotesBoard(labelViews, noteViews);
    }

    private static NoteView view(Note n, List<Long> labelIds) {
        List<ItemDto> items = n.getItems().stream().map(i -> new ItemDto(i.id(), i.text(), i.checked())).toList();
        return new NoteView(n.getId(), n.getTitle(), n.getBody(), n.isChecklist(), items, n.getColor(), n.isPinned(),
                n.isArchived(), n.getTrashedAt(), n.getPosition(), labelIds, n.getCreatedAt(), n.getUpdatedAt());
    }

    private Note find(long userId, long id) {
        return notes.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("ghi chú"));
    }

    private NoteLabel findLabel(long userId, long id) {
        return labels.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("nhãn"));
    }

    private static boolean isEmpty(Note n) {
        return n.getTitle().isEmpty() && n.getBody().isBlank()
                && n.getItems().stream().allMatch(i -> i.text().isBlank());
    }

    private static List<Note.Item> toItems(List<ItemDto> items) {
        if (items == null) return List.of();
        List<Note.Item> out = new ArrayList<>();
        for (ItemDto i : items) {
            String itemId = i.id() == null || i.id().isBlank() ? UUID.randomUUID().toString().substring(0, 8) : i.id();
            out.add(new Note.Item(itemId, i.text().strip(), i.checked()));
        }
        return out;
    }

    private static String color(String c) {
        if (c == null) return DEFAULT_COLOR;
        if (!COLORS.contains(c)) throw ApiException.badRequest("Màu không hợp lệ");
        return c;
    }

    private static String strip(String s) {
        return s == null ? "" : s.strip();
    }

    /** Giữ nguyên thụt đầu dòng, chỉ bỏ khoảng trắng thừa ở cuối. */
    private static String trimEnd(String s) {
        return s == null ? "" : s.stripTrailing();
    }
}
