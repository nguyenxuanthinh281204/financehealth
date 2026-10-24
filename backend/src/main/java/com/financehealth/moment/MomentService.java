package com.financehealth.moment;

import com.financehealth.common.ApiException;
import com.financehealth.config.AppProperties;
import com.financehealth.storage.StorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.UUID;

@Service
public class MomentService {

    public record MomentView(long id, LocalDate takenOn, Moment.MediaType mediaType, String url,
                             String contentType, BigDecimal durationSec, String caption) {}

    private static final Map<String, String> PHOTO_TYPES = Map.of(
            "image/jpeg", ".jpg", "image/png", ".png", "image/webp", ".webp");
    private static final Map<String, String> VIDEO_TYPES = Map.of(
            "video/mp4", ".mp4", "video/quicktime", ".mov", "video/webm", ".webm");

    private final MomentRepository moments;
    private final StorageService storage;
    private final double maxVideoSeconds;

    public MomentService(MomentRepository moments, StorageService storage, AppProperties props) {
        this.moments = moments;
        this.storage = storage;
        this.maxVideoSeconds = props.moments().maxVideoSeconds();
    }

    @Transactional
    public MomentView upload(long userId, MultipartFile file, LocalDate takenOn, Double clientDuration, String caption) {
        String type = baseType(file.getContentType());
        boolean isVideo = VIDEO_TYPES.containsKey(type);
        if (!isVideo && !PHOTO_TYPES.containsKey(type)) {
            throw ApiException.badRequest("Chỉ nhận ảnh JPG/PNG/WEBP hoặc video MP4/MOV/WEBM");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }

        BigDecimal duration = null;
        if (isVideo) {
            // MP4/MOV đọc được thời lượng thật từ file; WEBM thì tin số liệu trình duyệt gửi lên
            OptionalDouble real = type.equals("video/webm") ? OptionalDouble.empty() : Mp4Duration.read(bytes);
            double seconds = real.isPresent() ? real.getAsDouble() : (clientDuration == null ? 0 : clientDuration);
            if (seconds <= 0 && clientDuration == null) {
                throw ApiException.badRequest("Không xác định được thời lượng video");
            }
            if (seconds > maxVideoSeconds) {
                throw ApiException.badRequest("Video tối đa 5 giây (video của bạn dài %.1f giây)".formatted(seconds));
            }
            duration = BigDecimal.valueOf(seconds).setScale(2, RoundingMode.HALF_UP);
        }

        String ext = isVideo ? VIDEO_TYPES.get(type) : PHOTO_TYPES.get(type);
        String key = "moments/" + userId + "/" + takenOn + "/" + UUID.randomUUID() + ext;
        try {
            storage.put(key, new ByteArrayInputStream(bytes), bytes.length, type);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        String cleanCaption = caption == null || caption.isBlank() ? null : caption.trim();
        if (cleanCaption != null && cleanCaption.length() > 200) cleanCaption = cleanCaption.substring(0, 200);

        Moment m = moments.save(new Moment(userId, takenOn, isVideo ? Moment.MediaType.VIDEO : Moment.MediaType.PHOTO,
                key, type, bytes.length, duration, cleanCaption));
        return toView(m);
    }

    @Transactional(readOnly = true)
    public List<MomentView> list(long userId, LocalDate from, LocalDate to) {
        return moments.findByUserIdAndTakenOnBetweenOrderByTakenOnDescCreatedAtDesc(userId, from, to)
                .stream().map(this::toView).toList();
    }

    @Transactional
    public void delete(long userId, long id) {
        Moment m = moments.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("khoảnh khắc"));
        storage.delete(m.getStorageKey());
        moments.delete(m);
    }

    private MomentView toView(Moment m) {
        return new MomentView(m.getId(), m.getTakenOn(), m.getMediaType(), storage.signedUrl(m.getStorageKey()),
                m.getContentType(), m.getDurationSec(), m.getCaption());
    }

    private static String baseType(String contentType) {
        if (contentType == null) return "";
        int semi = contentType.indexOf(';');
        return (semi >= 0 ? contentType.substring(0, semi) : contentType).trim().toLowerCase();
    }
}
