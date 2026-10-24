package com.financehealth.storage;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.HandlerMapping;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

/** Trả file đã lưu local qua link có chữ ký. Hỗ trợ Range để Safari phát được video. */
@RestController
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalFileController {

    private final LocalStorageService storage;

    public LocalFileController(LocalStorageService storage) {
        this.storage = storage;
    }

    @GetMapping("/files/**")
    public ResponseEntity<Resource> get(HttpServletRequest request, @RequestParam long exp, @RequestParam String sig) {
        String path = (String) request.getAttribute(HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE);
        String key = path.substring("/files/".length());
        if (!storage.verify(key, exp, sig)) return ResponseEntity.status(403).build();
        Path file = storage.resolve(key);
        if (!Files.exists(file)) return ResponseEntity.notFound().build();
        Resource resource = new FileSystemResource(file);
        MediaType type = MediaTypeFactory.getMediaType(resource).orElse(MediaType.APPLICATION_OCTET_STREAM);
        return ResponseEntity.ok()
                .contentType(type)
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePrivate())
                .body(resource);
    }
}
