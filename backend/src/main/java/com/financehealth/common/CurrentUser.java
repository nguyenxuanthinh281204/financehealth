package com.financehealth.common;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

public final class CurrentUser {

    private CurrentUser() {}

    public static long id() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof Jwt jwt) {
            return Long.parseLong(jwt.getSubject());
        }
        throw new IllegalStateException("Chưa đăng nhập");
    }
}
