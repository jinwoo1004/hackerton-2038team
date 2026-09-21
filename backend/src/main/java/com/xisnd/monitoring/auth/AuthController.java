package com.xisnd.monitoring.auth;

import com.xisnd.monitoring.auth.dto.AuthResponse;
import com.xisnd.monitoring.auth.dto.LoginRequest;
import com.xisnd.monitoring.auth.dto.PasswordChangeRequest;
import com.xisnd.monitoring.auth.dto.ProfileUpdateRequest;
import com.xisnd.monitoring.auth.dto.SignupRequest;
import com.xisnd.monitoring.security.CurrentUser;
import com.xisnd.monitoring.user.UserResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.signup(request));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/me")
    public UserResponse me() {
        return authService.me(CurrentUser.id());
    }

    @PutMapping("/me")
    public UserResponse updateProfile(@Valid @RequestBody ProfileUpdateRequest request) {
        return authService.updateProfile(CurrentUser.id(), request);
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody PasswordChangeRequest request) {
        authService.changePassword(CurrentUser.id(), request);
        return ResponseEntity.noContent().build();
    }
}
