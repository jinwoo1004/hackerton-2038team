package com.xisnd.monitoring.security;

import com.xisnd.monitoring.common.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUser {

    private CurrentUser() {
    }

    public static Long id() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Long userId)) {
            throw ApiException.unauthorized("로그인이 필요합니다.");
        }
        return userId;
    }
}
