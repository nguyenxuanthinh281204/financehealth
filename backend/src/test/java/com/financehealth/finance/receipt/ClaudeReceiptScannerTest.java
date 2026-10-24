package com.financehealth.finance.receipt;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ClaudeReceiptScannerTest {

    @Test
    void buildsVisionRequestWithSchemaAndFallback() {
        var params = ClaudeReceiptScanner.buildParams("claude-opus-5-5", new byte[]{1, 2, 3}, "image/png");
        String raw = params.rawParams().toString();
        assertThat(raw).contains("claude-opus-5-5").contains("image/png").contains("json_schema").contains("fallbacks");
    }
}
