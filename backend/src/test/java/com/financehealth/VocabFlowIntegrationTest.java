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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Học từ vựng: bộ thẻ, thêm/nhập thẻ, hàng đợi ôn, chấm điểm, giới hạn thẻ mới, chuỗi ngày, phân quyền. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class VocabFlowIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    private JsonNode call(String bearer, MockHttpServletRequestBuilder req, String body, int expected) throws Exception {
        req.header("Authorization", bearer);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(body);
        var res = mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse();
        res.setCharacterEncoding("UTF-8");
        String text = res.getContentAsString();
        return text.isEmpty() ? null : json.readTree(text);
    }

    private String register() throws Exception {
        JsonNode auth = json.readTree(mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"v" + UUID.randomUUID() + "@test.vn\",\"password\":\"matkhau123\",\"displayName\":\"Thịnh\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        return "Bearer " + auth.get("token").asText();
    }

    @Test
    void vocabFlow() throws Exception {
        String me = register();

        JsonNode overview = call(me, get("/api/vocab"), null, 200);
        assertThat(overview.get("decks").size()).isZero();
        assertThat(overview.get("streak").asInt()).isZero();

        overview = call(me, post("/api/vocab/decks"), "{\"name\":\"  IELTS  \",\"newPerDay\":2}", 200);
        JsonNode deck = overview.at("/decks/0");
        long deckId = deck.get("id").asLong();
        assertThat(deck.get("name").asText()).isEqualTo("IELTS");
        assertThat(deck.get("language").asText()).isEqualTo("en-US");

        call(me, post("/api/vocab/decks"), "{\"name\":\"x\",\"language\":\"not a lang\"}", 400);

        JsonNode card = call(me, post("/api/vocab/decks/" + deckId + "/cards"),
                "{\"term\":\"abundant\",\"meaning\":\"dồi dào\",\"pronunciation\":\"/əˈbʌndənt/\",\"example\":\"  \"}", 200);
        assertThat(card.get("state").asText()).isEqualTo("NEW");
        assertThat(card.get("example")).isNull();
        JsonNode bulk = call(me, post("/api/vocab/decks/" + deckId + "/cards/bulk"),
                "{\"cards\":[{\"term\":\"brisk\",\"meaning\":\"nhanh nhẹn\"},{\"term\":\"candid\",\"meaning\":\"thẳng thắn\"}]}", 200);
        assertThat(bulk.get("added").asInt()).isEqualTo(2);
        assertThat(bulk.at("/deck/total").asInt()).isEqualTo(3);
        // Giới hạn 2 thẻ mới/ngày
        assertThat(bulk.at("/deck/newCount").asInt()).isEqualTo(2);
        call(me, post("/api/vocab/decks/" + deckId + "/cards/bulk"), "{\"cards\":[{\"term\":\"\",\"meaning\":\"x\"}]}", 400);

        // Hàng đợi: 2 thẻ mới theo thứ tự thêm, kèm nhãn thời gian 4 nút
        JsonNode study = call(me, get("/api/vocab/study?deckId=" + deckId), null, 200);
        assertThat(study.get("newCount").asInt()).isEqualTo(2);
        assertThat(study.get("queue").size()).isEqualTo(2);
        assertThat(study.at("/queue/0/card/term").asText()).isEqualTo("abundant");
        assertThat(study.at("/queue/0/intervals/2").asText()).isEqualTo("10 ph");
        long first = study.at("/queue/0/card/id").asLong();

        // Được → bước 10 phút: vẫn nằm cuối hàng đợi (học trước trong 20 phút)
        study = call(me, post("/api/vocab/cards/" + first + "/review"), "{\"rating\":3,\"deckId\":" + deckId + "}", 200);
        assertThat(study.get("newCount").asInt()).isEqualTo(1);
        assertThat(study.get("learningCount").asInt()).isEqualTo(1);
        assertThat(study.at("/queue/0/card/term").asText()).isEqualTo("brisk");
        assertThat(study.at("/queue/1/card/id").asLong()).isEqualTo(first);
        assertThat(study.get("reviewedToday").asInt()).isEqualTo(1);

        // Dễ → thuộc luôn, 4 ngày
        long second = study.at("/queue/0/card/id").asLong();
        study = call(me, post("/api/vocab/cards/" + second + "/review"), "{\"rating\":4}", 200);
        assertThat(study.get("newCount").asInt()).isZero();
        JsonNode cards = call(me, get("/api/vocab/decks/" + deckId + "/cards"), null, 200);
        JsonNode brisk = cards.get("cards").get(1);
        assertThat(brisk.get("state").asText()).isEqualTo("REVIEW");
        assertThat(brisk.get("intervalDays").asInt()).isEqualTo(4);
        // Đã dùng hết 2 thẻ mới hôm nay, thẻ thứ 3 phải chờ mai
        assertThat(cards.at("/deck/newCount").asInt()).isZero();
        assertThat(cards.at("/deck/unseen").asInt()).isEqualTo(1);

        // Được lần nữa ở bước cuối → thuộc, 1 ngày; hàng đợi trống
        study = call(me, post("/api/vocab/cards/" + first + "/review"), "{\"rating\":3,\"deckId\":" + deckId + "}", 200);
        assertThat(study.get("queue").size()).isZero();

        // Giả lập đến hạn: thẻ brisk đến hạn ôn
        jdbc.update("UPDATE vocab_cards SET due_at = now() - interval '1 hour' WHERE id = ?", second);
        overview = call(me, get("/api/vocab"), null, 200);
        assertThat(overview.at("/decks/0/due").asInt()).isEqualTo(1);
        assertThat(overview.get("reviewedToday").asInt()).isEqualTo(3);
        assertThat(overview.get("streak").asInt()).isEqualTo(1);
        study = call(me, get("/api/vocab/study"), null, 200);
        assertThat(study.get("reviewCount").asInt()).isEqualTo(1);
        assertThat(study.at("/queue/0/intervals/0").asText()).isEqualTo("10 ph");

        // Quên → học lại 10 phút; quá 20 phút thì hàng đợi trống và báo giờ học tiếp
        call(me, post("/api/vocab/cards/" + second + "/review"), "{\"rating\":1}", 200);
        jdbc.update("UPDATE vocab_cards SET due_at = now() + interval '1 hour' WHERE id = ?", second);
        study = call(me, get("/api/vocab/study"), null, 200);
        if (study.get("queue").size() == 0) assertThat(study.get("nextAt")).isNotNull();
        cards = call(me, get("/api/vocab/decks/" + deckId + "/cards"), null, 200);
        assertThat(cards.get("cards").get(1).get("lapses").asInt()).isEqualTo(1);
        assertThat(cards.get("cards").get(1).get("state").asText()).isEqualTo("RELEARNING");

        // Sửa thẻ, chuyển bộ, học lại từ đầu
        overview = call(me, post("/api/vocab/decks"), "{\"name\":\"Tiếng Nhật\",\"language\":\"ja-JP\"}", 200);
        long jp = overview.at("/decks/1/id").asLong();
        card = call(me, patch("/api/vocab/cards/" + second), "{\"meaning\":\"nhanh, lanh lợi\",\"deckId\":" + jp + "}", 200);
        assertThat(card.get("deckId").asLong()).isEqualTo(jp);
        assertThat(card.get("meaning").asText()).isEqualTo("nhanh, lanh lợi");
        card = call(me, post("/api/vocab/cards/" + second + "/reset"), null, 200);
        assertThat(card.get("state").asText()).isEqualTo("NEW");
        assertThat(card.get("dueAt")).isNull();

        // Người khác không đụng được
        String other = register();
        call(other, get("/api/vocab/decks/" + deckId + "/cards"), null, 404);
        call(other, post("/api/vocab/cards/" + first + "/review"), "{\"rating\":3}", 404);
        call(other, delete("/api/vocab/cards/" + first), null, 404);
        call(other, get("/api/vocab/study?deckId=" + deckId), null, 404);

        // Đổi cài đặt bộ, xóa thẻ, xóa bộ (thẻ đi theo)
        overview = call(me, patch("/api/vocab/decks/" + deckId), "{\"name\":\"IELTS 7.0\",\"newPerDay\":5}", 200);
        assertThat(overview.at("/decks/0/name").asText()).isEqualTo("IELTS 7.0");
        assertThat(overview.at("/decks/0/newCount").asInt()).isEqualTo(1);
        call(me, delete("/api/vocab/cards/" + first), null, 204);
        overview = call(me, delete("/api/vocab/decks/" + deckId), null, 200);
        assertThat(overview.get("decks").size()).isEqualTo(1);
        call(me, post("/api/vocab/cards/" + first + "/review"), "{\"rating\":3}", 404);
        call(me, post("/api/vocab/cards/" + second + "/review"), "{\"rating\":5}", 400);
    }
}
