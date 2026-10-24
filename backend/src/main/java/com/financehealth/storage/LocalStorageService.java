package com.financehealth.storage;

import com.financehealth.config.AppProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;

/** Lưu file trên ổ đĩa của server. Dùng khi chạy local hoặc server đơn giản. */
@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements StorageService {

    private final Path root;
    private final AppProperties props;
    private final byte[] signingKey;

    public LocalStorageService(AppProperties props) throws IOException {
        this.props = props;
        this.root = Path.of(props.storage().localDir()).toAbsolutePath().normalize();
        this.signingKey = ("files:" + props.jwt().secret()).getBytes(StandardCharsets.UTF_8);
        Files.createDirectories(root);
    }

    @Override
    public void put(String key, InputStream data, long size, String contentType) throws IOException {
        Path target = resolve(key);
        Files.createDirectories(target.getParent());
        Files.copy(data, target, StandardCopyOption.REPLACE_EXISTING);
    }

    @Override
    public String signedUrl(String key) {
        long exp = Instant.now().plusSeconds(props.storage().signedUrlMinutes() * 60).getEpochSecond();
        return props.storage().publicBaseUrl() + "/files/" + key
                + "?exp=" + exp + "&sig=" + URLEncoder.encode(sign(key, exp), StandardCharsets.UTF_8);
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public boolean verify(String key, long exp, String sig) {
        if (Instant.now().getEpochSecond() > exp) return false;
        return MessageDigest.isEqual(sign(key, exp).getBytes(StandardCharsets.UTF_8), sig.getBytes(StandardCharsets.UTF_8));
    }

    public Path resolve(String key) {
        Path p = root.resolve(key).normalize();
        if (!p.startsWith(root)) throw new IllegalArgumentException("Đường dẫn không hợp lệ");
        return p;
    }

    private String sign(String key, long exp) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(signingKey, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((key + "|" + exp).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
