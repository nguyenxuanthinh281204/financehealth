package com.financehealth.moment;

import org.junit.jupiter.api.Test;

import java.nio.ByteBuffer;

import static org.assertj.core.api.Assertions.assertThat;

class Mp4DurationTest {

    /** ftyp + moov(mvhd v0) tối giản. */
    private static byte[] mp4(int timescale, int duration) {
        ByteBuffer b = ByteBuffer.allocate(16 + 8 + 108);
        b.putInt(16).put("ftyp".getBytes()).put("isom".getBytes()).putInt(0);
        b.putInt(8 + 108).put("moov".getBytes());
        b.putInt(108).put("mvhd".getBytes());
        b.putInt(0);            // version + flags
        b.putInt(0).putInt(0);  // creation, modification
        b.putInt(timescale).putInt(duration);
        return b.array();
    }

    @Test
    void readsDuration() {
        assertThat(Mp4Duration.read(mp4(1000, 4800)).getAsDouble()).isEqualTo(4.8);
        assertThat(Mp4Duration.read(mp4(600, 6000)).getAsDouble()).isEqualTo(10.0);
    }

    @Test
    void garbageGivesEmpty() {
        assertThat(Mp4Duration.read(new byte[]{1, 2, 3, 4, 5, 6, 7, 8, 9})).isEmpty();
    }
}
