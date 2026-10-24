package com.financehealth.moment;

import java.nio.ByteBuffer;
import java.util.OptionalDouble;

/** Đọc thời lượng từ hộp moov/mvhd của file MP4/MOV mà không cần ffmpeg. */
final class Mp4Duration {

    private Mp4Duration() {}

    static OptionalDouble read(byte[] data) {
        try {
            ByteBuffer buf = ByteBuffer.wrap(data);
            return findMvhd(buf, 0, data.length, 0);
        } catch (RuntimeException e) {
            return OptionalDouble.empty();
        }
    }

    private static OptionalDouble findMvhd(ByteBuffer buf, int start, int end, int depth) {
        int pos = start;
        while (pos + 8 <= end) {
            long size = Integer.toUnsignedLong(buf.getInt(pos));
            String type = new String(new byte[]{buf.get(pos + 4), buf.get(pos + 5), buf.get(pos + 6), buf.get(pos + 7)});
            int header = 8;
            if (size == 1) {
                size = buf.getLong(pos + 8);
                header = 16;
            } else if (size == 0) {
                size = end - pos;
            }
            if (size < header || pos + size > end) return OptionalDouble.empty();

            if (type.equals("moov") && depth == 0) {
                return findMvhd(buf, pos + header, (int) (pos + size), 1);
            }
            if (type.equals("mvhd") && depth == 1) {
                int p = pos + header;
                int version = buf.get(p) & 0xff;
                long timescale, duration;
                if (version == 1) {
                    timescale = Integer.toUnsignedLong(buf.getInt(p + 20));
                    duration = buf.getLong(p + 24);
                } else {
                    timescale = Integer.toUnsignedLong(buf.getInt(p + 12));
                    duration = Integer.toUnsignedLong(buf.getInt(p + 16));
                }
                return timescale == 0 ? OptionalDouble.empty() : OptionalDouble.of((double) duration / timescale);
            }
            pos += (int) size;
        }
        return OptionalDouble.empty();
    }
}
