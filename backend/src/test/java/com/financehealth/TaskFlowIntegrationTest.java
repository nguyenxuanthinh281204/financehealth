package com.financehealth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Việc cần làm: danh sách, việc con, hoàn thành, sắp xếp, chuyển danh sách, xóa việc đã xong. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskFlowIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String bearer;

    private JsonNode call(MockHttpServletRequestBuilder req, String body, int expected) throws Exception {
        req.header("Authorization", bearer);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(body);
        var res = mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse();
        res.setCharacterEncoding("UTF-8");
        String text = res.getContentAsString();
        return text.isEmpty() ? null : json.readTree(text);
    }

    private static JsonNode task(JsonNode board, String title) {
        for (JsonNode t : board.get("tasks")) if (t.get("title").asText().equals(title)) return t;
        return null;
    }

    /** Tên các việc chính chưa xong của danh sách, theo thứ tự hiển thị. */
    private static List<String> openTitles(JsonNode board, long listId) {
        List<String> out = new ArrayList<>();
        for (JsonNode t : board.get("tasks")) {
            if (t.get("listId").asLong() == listId && t.get("parentId") == null && !t.get("completed").asBoolean()) {
                out.add(t.get("title").asText());
            }
        }
        return out;
    }

    @Test
    void taskFlow() throws Exception {
        bearer = null;
        JsonNode auth = json.readTree(mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"t" + UUID.randomUUID() + "@test.vn\",\"password\":\"matkhau123\",\"displayName\":\"Thịnh\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        bearer = "Bearer " + auth.get("token").asText();

        // Lần đầu có sẵn một danh sách
        JsonNode board = call(get("/api/tasks"), null, 200);
        assertThat(board.get("lists").size()).isEqualTo(1);
        assertThat(board.at("/lists/0/name").asText()).isEqualTo("Việc của tôi");
        assertThat(board.get("today").asText()).isNotEmpty();
        long listId = board.at("/lists/0/id").asLong();
        String today = board.get("today").asText();

        // Việc mới nằm trên cùng
        call(post("/api/tasks"), "{\"listId\":" + listId + ",\"title\":\"Mua sữa\"}", 200);
        call(post("/api/tasks"), "{\"listId\":" + listId + ",\"title\":\"Đóng tiền điện\",\"dueDate\":\"" + today + "\"}", 200);
        board = call(post("/api/tasks"), "{\"listId\":" + listId + ",\"title\":\"Dọn nhà\",\"notes\":\"  phòng khách  \"}", 200);
        assertThat(openTitles(board, listId)).containsExactly("Dọn nhà", "Đóng tiền điện", "Mua sữa");
        assertThat(task(board, "Dọn nhà").get("notes").asText()).isEqualTo("phòng khách");
        assertThat(task(board, "Đóng tiền điện").get("dueDate").asText()).isEqualTo(today);
        long cleanId = task(board, "Dọn nhà").get("id").asLong();
        long milkId = task(board, "Mua sữa").get("id").asLong();
        long billId = task(board, "Đóng tiền điện").get("id").asLong();

        // Việc con: thêm ở cuối, không lồng hai cấp
        call(post("/api/tasks"), "{\"parentId\":" + cleanId + ",\"title\":\"Lau sàn\"}", 200);
        board = call(post("/api/tasks"), "{\"parentId\":" + cleanId + ",\"title\":\"Hút bụi\"}", 200);
        JsonNode floor = task(board, "Lau sàn");
        assertThat(floor.get("parentId").asLong()).isEqualTo(cleanId);
        assertThat(floor.get("position").asInt()).isLessThan(task(board, "Hút bụi").get("position").asInt());
        call(post("/api/tasks"), "{\"parentId\":" + floor.get("id").asLong() + ",\"title\":\"x\"}", 400);
        call(post("/api/tasks"), "{\"title\":\"thiếu danh sách\"}", 400);

        // Xong việc cha thì xong luôn việc con, mở lại việc con thì việc cha mở lại
        board = call(patch("/api/tasks/" + cleanId), "{\"completed\":true}", 200);
        assertThat(task(board, "Lau sàn").get("completed").asBoolean()).isTrue();
        assertThat(task(board, "Dọn nhà").get("completedAt").asText()).isNotEmpty();
        board = call(patch("/api/tasks/" + floor.get("id").asLong()), "{\"completed\":false}", 200);
        assertThat(task(board, "Dọn nhà").get("completed").asBoolean()).isFalse();
        assertThat(task(board, "Hút bụi").get("completed").asBoolean()).isTrue();

        // Sửa, gắn sao, bỏ ngày hạn
        board = call(patch("/api/tasks/" + billId), "{\"title\":\"Đóng tiền điện tháng 10\",\"starred\":true,\"clearDue\":true}", 200);
        JsonNode bill = task(board, "Đóng tiền điện tháng 10");
        assertThat(bill.get("starred").asBoolean()).isTrue();
        assertThat(bill.has("dueDate")).isFalse();
        call(patch("/api/tasks/" + billId), "{\"title\":\"  \"}", 400);

        // Sắp xếp lại
        board = call(put("/api/tasks/order"), "{\"listId\":" + listId + ",\"ids\":[" + milkId + "," + cleanId + "," + billId + "]}", 200);
        assertThat(openTitles(board, listId)).containsExactly("Mua sữa", "Dọn nhà", "Đóng tiền điện tháng 10");
        call(put("/api/tasks/order"), "{\"listId\":" + listId + ",\"ids\":[" + milkId + "," + floor.get("id").asLong() + "]}", 400);

        // Danh sách thứ hai, chuyển việc kèm việc con sang
        board = call(post("/api/task-lists"), "{\"name\":\"Công việc\"}", 200);
        assertThat(board.get("lists").size()).isEqualTo(2);
        long workId = board.at("/lists/1/id").asLong();
        board = call(patch("/api/tasks/" + cleanId), "{\"listId\":" + workId + "}", 200);
        assertThat(task(board, "Dọn nhà").get("listId").asLong()).isEqualTo(workId);
        assertThat(task(board, "Lau sàn").get("listId").asLong()).isEqualTo(workId);
        call(patch("/api/tasks/" + floor.get("id").asLong()), "{\"listId\":" + listId + "}", 400);
        board = call(patch("/api/task-lists/" + workId), "{\"name\":\"Việc nhà\"}", 200);
        assertThat(board.at("/lists/1/name").asText()).isEqualTo("Việc nhà");

        // Xóa việc đã xong: việc con đã xong cũng bị xóa, việc chưa xong còn nguyên
        call(patch("/api/tasks/" + milkId), "{\"completed\":true}", 200);
        board = call(delete("/api/task-lists/" + listId + "/completed"), null, 200);
        assertThat(task(board, "Mua sữa")).isNull();
        assertThat(task(board, "Đóng tiền điện tháng 10")).isNotNull();
        board = call(delete("/api/task-lists/" + workId + "/completed"), null, 200);
        assertThat(task(board, "Hút bụi")).isNull();
        assertThat(task(board, "Lau sàn")).isNotNull();

        // Xóa việc cha thì xóa luôn việc con
        board = call(delete("/api/tasks/" + cleanId), null, 200);
        assertThat(task(board, "Lau sàn")).isNull();

        // Xóa danh sách kèm việc bên trong, nhưng phải giữ lại ít nhất một
        board = call(delete("/api/task-lists/" + listId), null, 200);
        assertThat(board.get("lists").size()).isEqualTo(1);
        assertThat(board.get("tasks").size()).isZero();
        call(delete("/api/task-lists/" + workId), null, 400);

        // Không đụng được vào dữ liệu người khác
        call(patch("/api/tasks/999999999"), "{\"completed\":true}", 404);
    }
}
