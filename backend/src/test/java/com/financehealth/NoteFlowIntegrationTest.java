package com.financehealth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Ghi chú: tạo chữ/danh sách, ghim, lưu trữ, thùng rác, nhãn, sao chép. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NoteFlowIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    private String bearer;

    private JsonNode call(MockHttpServletRequestBuilder req, String body, int expected) throws Exception {
        req.header("Authorization", bearer);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(body);
        var res = mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse();
        res.setCharacterEncoding("UTF-8");
        String text = res.getContentAsString();
        return text.isEmpty() ? null : json.readTree(text);
    }

    private static JsonNode note(JsonNode board, long id) {
        for (JsonNode n : board.get("notes")) if (n.get("id").asLong() == id) return n;
        return null;
    }

    private static List<String> titles(JsonNode board) {
        List<String> out = new ArrayList<>();
        for (JsonNode n : board.get("notes")) out.add(n.get("title").asText());
        return out;
    }

    @Test
    void noteFlow() throws Exception {
        JsonNode auth = json.readTree(mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"n" + UUID.randomUUID() + "@test.vn\",\"password\":\"matkhau123\",\"displayName\":\"Thịnh\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        bearer = "Bearer " + auth.get("token").asText();

        JsonNode board = call(get("/api/notes"), null, 200);
        assertThat(board.get("notes").size()).isZero();

        // Ghi chú chữ, giữ thụt đầu dòng; ghi chú trống bị từ chối
        JsonNode text = call(post("/api/notes"), "{\"title\":\" Ý tưởng \",\"body\":\"  - dòng 1\\n  - dòng 2  \\n\"}", 200);
        assertThat(text.get("title").asText()).isEqualTo("Ý tưởng");
        assertThat(text.get("body").asText()).isEqualTo("  - dòng 1\n  - dòng 2");
        assertThat(text.get("color").asText()).isEqualTo("default");
        call(post("/api/notes"), "{\"title\":\"  \",\"body\":\"\"}", 400);
        call(post("/api/notes"), "{\"title\":\"x\",\"color\":\"neon\"}", 400);

        // Ghi chú danh sách, màu, ghim; mục thiếu id được cấp id
        JsonNode list = call(post("/api/notes"), """
                {"title":"Đi chợ","checklist":true,"color":"yellow","pinned":true,
                 "items":[{"id":"a1","text":"Trứng","checked":false},{"text":"Ức gà","checked":true}]}""", 200);
        long listId = list.get("id").asLong();
        assertThat(list.get("checklist").asBoolean()).isTrue();
        assertThat(list.get("pinned").asBoolean()).isTrue();
        assertThat(list.at("/items/0/id").asText()).isEqualTo("a1");
        assertThat(list.at("/items/1/id").asText()).isNotEmpty();
        assertThat(list.at("/items/1/checked").asBoolean()).isTrue();

        // Ghi chú mới nằm trên cùng
        board = call(get("/api/notes"), null, 200);
        assertThat(titles(board)).containsExactly("Đi chợ", "Ý tưởng");

        // Sửa: tick mục, đổi màu; ghim/màu không đổi "lần sửa cuối"
        String updatedAt = list.get("updatedAt").asText();
        JsonNode upd = call(patch("/api/notes/" + listId), "{\"color\":\"green\",\"pinned\":false}", 200);
        assertThat(upd.get("updatedAt").asText()).isEqualTo(updatedAt);
        upd = call(patch("/api/notes/" + listId), "{\"items\":[{\"id\":\"a1\",\"text\":\"Trứng\",\"checked\":true}]}", 200);
        assertThat(upd.get("items").size()).isEqualTo(1);
        assertThat(upd.at("/items/0/checked").asBoolean()).isTrue();
        assertThat(upd.get("color").asText()).isEqualTo("green");

        // Lưu trữ thì bỏ ghim; ghim lại thì ra khỏi lưu trữ
        long textId = text.get("id").asLong();
        call(patch("/api/notes/" + textId), "{\"pinned\":true}", 200);
        upd = call(patch("/api/notes/" + textId), "{\"archived\":true}", 200);
        assertThat(upd.get("archived").asBoolean()).isTrue();
        assertThat(upd.get("pinned").asBoolean()).isFalse();
        upd = call(patch("/api/notes/" + textId), "{\"pinned\":true}", 200);
        assertThat(upd.get("archived").asBoolean()).isFalse();

        // Nhãn: tạo, trùng tên (không phân biệt hoa thường), gắn, đổi tên, xóa
        board = call(post("/api/note-labels"), "{\"name\":\"Nhà\"}", 200);
        long home = board.at("/labels/0/id").asLong();
        call(post("/api/note-labels"), "{\"name\":\"nhà\"}", 400);
        board = call(post("/api/note-labels"), "{\"name\":\"Công việc\"}", 200);
        long work = board.at("/labels/0/id").asLong();
        assertThat(board.at("/labels/0/name").asText()).isEqualTo("Công việc");
        upd = call(patch("/api/notes/" + listId), "{\"labelIds\":[" + home + "," + work + "," + home + "]}", 200);
        assertThat(upd.get("labelIds").size()).isEqualTo(2);
        call(patch("/api/notes/" + listId), "{\"labelIds\":[999999999]}", 404);
        board = call(patch("/api/note-labels/" + home), "{\"name\":\"Gia đình\"}", 200);
        assertThat(board.at("/labels/1/name").asText()).isEqualTo("Gia đình");
        board = call(delete("/api/note-labels/" + work), null, 200);
        assertThat(board.get("labels").size()).isEqualTo(1);
        assertThat(note(board, listId).get("labelIds").size()).isEqualTo(1);

        // Sao chép giữ nội dung và nhãn, nằm trên cùng
        JsonNode copy = call(post("/api/notes/" + listId + "/copy"), null, 200);
        assertThat(copy.get("title").asText()).isEqualTo("Đi chợ");
        assertThat(copy.get("labelIds").size()).isEqualTo(1);
        assertThat(copy.get("position").asLong()).isLessThan(list.get("position").asLong());

        // Thùng rác: không sửa được, khôi phục được, xóa vĩnh viễn chỉ khi đã ở thùng rác
        long copyId = copy.get("id").asLong();
        call(delete("/api/notes/" + copyId), null, 400);
        upd = call(patch("/api/notes/" + copyId), "{\"trashed\":true}", 200);
        assertThat(upd.get("trashedAt").asText()).isNotEmpty();
        call(patch("/api/notes/" + copyId), "{\"title\":\"sửa\"}", 400);
        upd = call(patch("/api/notes/" + copyId), "{\"trashed\":false}", 200);
        assertThat(upd.has("trashedAt")).isFalse();
        call(patch("/api/notes/" + copyId), "{\"trashed\":true}", 200);
        call(delete("/api/notes/" + copyId), null, 204);

        // Dọn thùng rác, và tự xóa sau 7 ngày
        call(patch("/api/notes/" + textId), "{\"trashed\":true}", 200);
        board = call(delete("/api/notes/trash"), null, 200);
        assertThat(titles(board)).containsExactly("Đi chợ");
        call(patch("/api/notes/" + listId), "{\"trashed\":true}", 200);
        jdbc.update("UPDATE notes SET trashed_at = now() - interval '8 days' WHERE id = ?", listId);
        board = call(get("/api/notes"), null, 200);
        assertThat(board.get("notes").size()).isZero();

        // Không đụng được vào dữ liệu người khác
        call(patch("/api/notes/999999999"), "{\"pinned\":true}", 404);
    }
}
