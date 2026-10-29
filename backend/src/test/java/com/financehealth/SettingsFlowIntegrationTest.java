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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Cài đặt tài khoản: tên, giao diện, màu chủ đạo, đổi mật khẩu (token cũ hết hiệu lực). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SettingsFlowIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private JsonNode call(MockHttpServletRequestBuilder req, String bearer, String body, int expected) throws Exception {
        if (bearer != null) req.header("Authorization", bearer);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(body);
        var res = mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse();
        res.setCharacterEncoding("UTF-8");
        String text = res.getContentAsString();
        return text.isEmpty() ? null : json.readTree(text);
    }

    @Test
    void settingsFlow() throws Exception {
        String email = "s" + UUID.randomUUID() + "@test.vn";
        JsonNode auth = call(post("/api/auth/register"), null,
                "{\"email\":\"" + email + "\",\"password\":\"matkhau123\",\"displayName\":\"Thịnh\"}", 200);
        String oldBearer = "Bearer " + auth.get("token").asText();
        assertThat(auth.at("/user/themeMode").asText()).isEqualTo("SYSTEM");
        assertThat(auth.at("/user/accentColor").asText()).isEqualTo("green");

        JsonNode me = call(patch("/api/me"), oldBearer,
                "{\"displayName\":\"  Xuân Thịnh  \",\"themeMode\":\"DARK\",\"accentColor\":\"violet\"}", 200);
        assertThat(me.get("displayName").asText()).isEqualTo("Xuân Thịnh");
        assertThat(me.get("themeMode").asText()).isEqualTo("DARK");
        assertThat(me.get("accentColor").asText()).isEqualTo("violet");

        // Trường không gửi thì giữ nguyên
        me = call(patch("/api/me"), oldBearer, "{\"accentColor\":\"blue\"}", 200);
        assertThat(me.get("displayName").asText()).isEqualTo("Xuân Thịnh");
        assertThat(me.get("themeMode").asText()).isEqualTo("DARK");

        call(patch("/api/me"), oldBearer, "{\"accentColor\":\"tim\"}", 400);
        call(patch("/api/me"), oldBearer, "{\"displayName\":\"   \"}", 400);
        call(patch("/api/me"), oldBearer, "{\"themeMode\":\"NEON\"}", 400);

        call(post("/api/me/password"), oldBearer, "{\"currentPassword\":\"sai\",\"newPassword\":\"matkhau456\"}", 400);
        call(post("/api/me/password"), oldBearer, "{\"currentPassword\":\"matkhau123\",\"newPassword\":\"ngan\"}", 400);
        call(post("/api/me/password"), oldBearer, "{\"currentPassword\":\"matkhau123\",\"newPassword\":\"matkhau123\"}", 400);
        JsonNode changed = call(post("/api/me/password"), oldBearer,
                "{\"currentPassword\":\"matkhau123\",\"newPassword\":\"matkhau456\"}", 200);
        String newBearer = "Bearer " + changed.get("token").asText();

        call(get("/api/me"), oldBearer, null, 401);
        assertThat(call(get("/api/me"), newBearer, null, 200).get("accentColor").asText()).isEqualTo("blue");
        call(post("/api/auth/login"), null, "{\"email\":\"" + email + "\",\"password\":\"matkhau123\"}", 401);
        call(post("/api/auth/login"), null, "{\"email\":\"" + email + "\",\"password\":\"matkhau456\"}", 200);
    }
}
