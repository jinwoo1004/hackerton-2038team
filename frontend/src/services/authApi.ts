import { USE_MOCK } from "@/shared/config/app";
import type {
  AuthResponse,
  LoginRequest,
  PasswordChangeRequest,
  ProfileUpdateRequest,
  SignupRequest,
  User,
} from "@/types";
import { getToken, request, setToken } from "./http";
import { mockApi } from "./mock/store";

export const authApi = {
  signup(body: SignupRequest): Promise<AuthResponse> {
    if (USE_MOCK) return mockApi.signup(body);
    return request<AuthResponse>("/api/auth/signup", { method: "POST", json: body });
  },

  login(body: LoginRequest): Promise<AuthResponse> {
    if (USE_MOCK) return mockApi.login(body);
    return request<AuthResponse>("/api/auth/login", { method: "POST", json: body });
  },

  me(): Promise<User> {
    if (USE_MOCK) {
      const token = getToken();
      if (!token) return Promise.reject(new Error("로그인이 필요합니다."));
      return mockApi.me(token);
    }
    return request<User>("/api/auth/me");
  },

  updateProfile(body: ProfileUpdateRequest): Promise<User> {
    if (USE_MOCK) return mockApi.updateProfile(getToken() ?? "", body);
    return request<User>("/api/auth/me", { method: "PUT", json: body });
  },

  changePassword(body: PasswordChangeRequest): Promise<void> {
    if (USE_MOCK) return mockApi.changePassword(getToken() ?? "", body);
    return request<void>("/api/auth/password", { method: "PUT", json: body });
  },

  logout() {
    setToken(null);
  },
};
