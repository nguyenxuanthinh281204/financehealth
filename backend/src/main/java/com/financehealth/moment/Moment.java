package com.financehealth.moment;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "moments")
public class Moment {

    public enum MediaType { PHOTO, VIDEO }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "taken_on", nullable = false)
    private LocalDate takenOn;

    @Enumerated(EnumType.STRING)
    @Column(name = "media_type", nullable = false)
    private MediaType mediaType;

    @Column(name = "storage_key", nullable = false)
    private String storageKey;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "duration_sec")
    private BigDecimal durationSec;

    private String caption;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Moment() {}

    public Moment(Long userId, LocalDate takenOn, MediaType mediaType, String storageKey, String contentType,
                  long sizeBytes, BigDecimal durationSec, String caption) {
        this.userId = userId;
        this.takenOn = takenOn;
        this.mediaType = mediaType;
        this.storageKey = storageKey;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.durationSec = durationSec;
        this.caption = caption;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public LocalDate getTakenOn() { return takenOn; }
    public MediaType getMediaType() { return mediaType; }
    public String getStorageKey() { return storageKey; }
    public String getContentType() { return contentType; }
    public long getSizeBytes() { return sizeBytes; }
    public BigDecimal getDurationSec() { return durationSec; }
    public String getCaption() { return caption; }
    public Instant getCreatedAt() { return createdAt; }
}
