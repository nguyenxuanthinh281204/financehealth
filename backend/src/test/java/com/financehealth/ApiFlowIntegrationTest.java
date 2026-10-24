package com.financehealth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Chạy toàn bộ luồng chính trên PostgreSQL thật (database financehealth_test). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiFlowIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private JsonNode call(org.springframework.test.web.servlet.RequestBuilder req, int expected) throws Exception {
        var res = mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse();
        res.setCharacterEncoding("UTF-8");
        String body = res.getContentAsString();
        return body.isEmpty() ? null : json.readTree(body);
    }

    @Test
    void fullFlow() throws Exception {
        String email = "u" + UUID.randomUUID() + "@test.vn";
        JsonNode auth = call(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"matkhau123\",\"displayName\":\"Thịnh\"}"), 200);
        String bearer = "Bearer " + auth.get("token").asText();

        call(get("/api/me"), 401);
        assertThat(call(get("/api/me").header("Authorization", bearer), 200).get("email").asText()).isEqualTo(email);
        call(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"sai\"}"), 401);

        // Chưa có hồ sơ thì không tạo được thực đơn
        call(get("/api/body/profile").header("Authorization", bearer), 204);

        JsonNode profile = call(put("/api/body/profile").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"sex":"MALE","birthDate":"2000-10-24","heightCm":175,"weightKg":70,
                         "activityLevel":"MODERATE","goal":"MAINTAIN","targetWeightKg":68}"""), 200);
        int kcal = profile.at("/macros/kcal").asInt();
        assertThat(kcal).isGreaterThan(2000);

        JsonNode foods = call(get("/api/foods").header("Authorization", bearer), 200);
        assertThat(foods.size()).isGreaterThan(20);
        StringBuilder sel = new StringBuilder();
        for (JsonNode f : foods) {
            String name = f.get("name").asText();
            if (name.startsWith("Ức gà") || name.equals("Cơm trắng") || name.equals("Trứng gà")
                    || name.startsWith("Yến mạch") || name.equals("Bông cải xanh")) {
                if (!sel.isEmpty()) sel.append(',');
                sel.append("{\"foodId\":").append(f.get("id").asLong()).append('}');
            }
        }
        String tomorrow = LocalDate.now().plusDays(1).toString();
        JsonNode plan = call(post("/api/meal-plans/generate").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\":\"" + tomorrow + "\",\"selections\":[" + sel + "]}"), 200);
        assertThat(plan.get("meals").size()).isEqualTo(3);
        double total = plan.at("/total/kcal").asDouble();
        assertThat(total).isBetween(kcal * 0.85, kcal * 1.15);

        long itemId = plan.at("/meals/1/items/0/id").asLong();
        JsonNode edited = call(patch("/api/meal-plans/items/" + itemId).header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content("{\"grams\":100}"), 200);
        assertThat(edited.at("/meals/1/items/0/grams").asInt()).isEqualTo(100);
        call(get("/api/meal-plans/" + tomorrow).header("Authorization", bearer), 200);

        // Chi tiêu
        String today = LocalDate.now().toString();
        call(post("/api/expenses").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content("{\"spentOn\":\"" + today + "\",\"amount\":45000,\"category\":\"FOOD\",\"merchant\":\"Phở Hà Nội\"}"), 200);
        call(post("/api/expenses").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content("{\"spentOn\":\"" + today + "\",\"amount\":320000,\"category\":\"GROCERIES\",\"items\":[{\"name\":\"Ức gà\",\"quantity\":1,\"price\":120000}]}"), 200);

        // Quét hóa đơn khi chưa cấu hình AI: vẫn lưu ảnh, báo nhập tay
        JsonNode scan = call(multipart("/api/expenses/scan-receipt")
                .file(new MockMultipartFile("file", "bill.jpg", "image/jpeg", new byte[]{(byte) 0xFF, (byte) 0xD8, 1, 2}))
                .header("Authorization", bearer), 200);
        assertThat(scan.get("enabled").asBoolean()).isFalse();
        assertThat(scan.get("receiptKey").asText()).startsWith("receipts/");

        // Ảnh khoảnh khắc + link file có chữ ký
        JsonNode moment = call(multipart("/api/moments")
                .file(new MockMultipartFile("file", "a.jpg", "image/jpeg", new byte[]{(byte) 0xFF, (byte) 0xD8, 9}))
                .param("takenOn", today).param("caption", "Hôm nay").header("Authorization", bearer), 200);
        String url = moment.get("url").asText();
        String path = url.substring(url.indexOf("/files/"));
        mvc.perform(get(java.net.URI.create(path))).andExpect(status().isOk());
        mvc.perform(get(java.net.URI.create(path.replaceAll("sig=[^&]+", "sig=abc")))).andExpect(status().isForbidden());

        // Video quá 5 giây bị từ chối
        call(multipart("/api/moments")
                .file(new MockMultipartFile("file", "v.webm", "video/webm", new byte[]{1, 2, 3}))
                .param("takenOn", today).param("durationSec", "8").header("Authorization", bearer), 400);

        // Tổng kết tháng
        JsonNode summary = call(get("/api/summary/monthly").param("month", YearMonth.now().toString())
                .header("Authorization", bearer), 200);
        assertThat(summary.at("/spending/total").decimalValue().intValue()).isEqualTo(365000);
        assertThat(summary.at("/spending/byCategory/0/category").asText()).isEqualTo("GROCERIES");
        assertThat(summary.at("/weight/end").asDouble()).isEqualTo(70.0);
        assertThat(summary.at("/moments/count").asInt()).isEqualTo(1);
    }
}
