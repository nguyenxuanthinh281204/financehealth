package com.financehealth.auth;

import com.financehealth.auth.AuthDtos.*;
import com.financehealth.common.ApiException;
import com.financehealth.config.AppProperties;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
public class AuthService {

    public static final String TOKEN_VERSION_CLAIM = "ver";

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;
    private final AppProperties props;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder,
                       JwtEncoder jwtEncoder, AppProperties props) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
        this.props = props;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String email = req.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "Email đã được đăng ký");
        }
        User user = users.save(new User(email, passwordEncoder.encode(req.password()), req.displayName().trim()));
        return new AuthResponse(issueToken(user), UserView.of(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        User user = users.findByEmailIgnoreCase(req.email().trim())
                .filter(u -> passwordEncoder.matches(req.password(), u.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Email hoặc mật khẩu không đúng"));
        return new AuthResponse(issueToken(user), UserView.of(user));
    }

    @Transactional(readOnly = true)
    public UserView me(long userId) {
        return UserView.of(load(userId));
    }

    @Transactional
    public UserView updateSettings(long userId, UpdateSettingsRequest req) {
        User user = load(userId);
        if (req.displayName() != null) {
            String name = req.displayName().trim();
            if (name.isEmpty()) throw ApiException.badRequest("Tên không được để trống");
            user.setDisplayName(name);
        }
        if (req.themeMode() != null) user.setThemeMode(req.themeMode());
        if (req.accentColor() != null) user.setAccentColor(req.accentColor());
        return UserView.of(user);
    }

    /** Đổi mật khẩu, trả token mới; token cũ trên các thiết bị khác hết hiệu lực. */
    @Transactional
    public AuthResponse changePassword(long userId, ChangePasswordRequest req) {
        User user = load(userId);
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("Mật khẩu hiện tại không đúng");
        }
        if (req.currentPassword().equals(req.newPassword())) {
            throw ApiException.badRequest("Mật khẩu mới phải khác mật khẩu hiện tại");
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        user.bumpTokenVersion();
        return new AuthResponse(issueToken(user), UserView.of(user));
    }

    private User load(long userId) {
        return users.findById(userId).orElseThrow(() -> ApiException.notFound("người dùng"));
    }

    private String issueToken(User user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("financehealth")
                .subject(String.valueOf(user.getId()))
                .issuedAt(now)
                .expiresAt(now.plus(Duration.ofHours(props.jwt().ttlHours())))
                .claim("email", user.getEmail())
                .claim(TOKEN_VERSION_CLAIM, user.getTokenVersion())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
