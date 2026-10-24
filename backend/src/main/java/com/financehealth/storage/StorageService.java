package com.financehealth.storage;

import java.io.IOException;
import java.io.InputStream;

public interface StorageService {

    void put(String key, InputStream data, long size, String contentType) throws IOException;

    /** Link xem file có thời hạn, dùng trực tiếp trong thẻ img/video. */
    String signedUrl(String key);

    void delete(String key);
}
