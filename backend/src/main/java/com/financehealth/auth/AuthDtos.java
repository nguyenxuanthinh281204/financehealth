package com.financehealth.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(max = 100) String displayName) {}

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

    /** Các trường null thì giữ nguyên. */
    public record UpdateSettingsRequest(
            @Size(min = 1, max = 100) String displayName,
            User.ThemeMode themeMode,
            @Pattern(regexp = ACCENTS, message = "Màu không hợp lệ") String accentColor) {}

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 8, max = 72) String newPassword) {}

    public static final String ACCENTS = "green|teal|blue|violet|pink|orange|yellow";

    public record UserView(long id, String email, String displayName, User.ThemeMode themeMode, String accentColor) {
        static UserView of(User u) {
            return new UserView(u.getId(), u.getEmail(), u.getDisplayName(), u.getThemeMode(), u.getAccentColor());
        }
    }

    public record AuthResponse(String token, UserView user) {}
}
