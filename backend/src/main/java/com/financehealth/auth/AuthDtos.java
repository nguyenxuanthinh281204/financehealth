package com.financehealth.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(max = 100) String displayName) {}

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

    public record UserView(long id, String email, String displayName) {
        static UserView of(User u) {
            return new UserView(u.getId(), u.getEmail(), u.getDisplayName());
        }
    }

    public record AuthResponse(String token, UserView user) {}
}
