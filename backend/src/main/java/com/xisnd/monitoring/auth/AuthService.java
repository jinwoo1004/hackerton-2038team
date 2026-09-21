package com.xisnd.monitoring.auth;

import com.xisnd.monitoring.auth.dto.AuthResponse;
import com.xisnd.monitoring.auth.dto.LoginRequest;
import com.xisnd.monitoring.auth.dto.PasswordChangeRequest;
import com.xisnd.monitoring.auth.dto.ProfileUpdateRequest;
import com.xisnd.monitoring.auth.dto.SignupRequest;
import com.xisnd.monitoring.common.ApiException;
import com.xisnd.monitoring.security.JwtTokenProvider;
import com.xisnd.monitoring.user.Role;
import com.xisnd.monitoring.user.User;
import com.xisnd.monitoring.user.UserRepository;
import com.xisnd.monitoring.user.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw ApiException.conflict("이미 가입된 이메일입니다.");
        }

        User user = userRepository.save(User.builder()
                .email(email)
                .password(passwordEncoder.encode(request.password()))
                .name(request.name().trim())
                .company(blankToNull(request.company()))
                .department(blankToNull(request.department()))
                .role(Role.USER)
                .build());

        return toAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase();
        // 계정 존재 여부가 드러나지 않게 같은 메시지 사용
        User user = userRepository.findByEmail(email)
                .filter(u -> passwordEncoder.matches(request.password(), u.getPassword()))
                .orElseThrow(() -> ApiException.unauthorized("이메일 또는 비밀번호가 올바르지 않습니다."));

        return toAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse me(Long userId) {
        return userRepository.findById(userId)
                .map(UserResponse::from)
                .orElseThrow(() -> ApiException.unauthorized("세션이 만료되었습니다. 다시 로그인해주세요."));
    }

    @Transactional
    public UserResponse updateProfile(Long userId, ProfileUpdateRequest request) {
        User user = findUser(userId);
        user.updateProfile(request.name().trim(), blankToNull(request.company()), blankToNull(request.department()));
        return UserResponse.from(user);
    }

    @Transactional
    public void changePassword(Long userId, PasswordChangeRequest request) {
        User user = findUser(userId);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw ApiException.badRequest("현재 비밀번호가 올바르지 않습니다.");
        }
        if (request.currentPassword().equals(request.newPassword())) {
            throw ApiException.badRequest("새 비밀번호가 현재 비밀번호와 같습니다.");
        }
        user.changePassword(passwordEncoder.encode(request.newPassword()));
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("세션이 만료되었습니다. 다시 로그인해주세요."));
    }

    private AuthResponse toAuthResponse(User user) {
        String token = tokenProvider.createToken(user.getId(), user.getEmail());
        return new AuthResponse(token, UserResponse.from(user));
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
