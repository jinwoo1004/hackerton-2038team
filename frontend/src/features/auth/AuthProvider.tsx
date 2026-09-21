"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "@/services/authApi";
import { getToken, setToken, UNAUTHORIZED_EVENT } from "@/services/http";
import type { LoginRequest, SignupRequest, User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (body: LoginRequest) => Promise<void>;
  signup: (body: SignupRequest) => Promise<void>;
  logout: () => void;
  refreshUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!getToken()) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((u) => alive && setUser(u))
      .catch(() => {
        setToken(null);
        if (alive) setUser(null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(async (body: LoginRequest) => {
    const res = await authApi.login(body);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const signup = useCallback(async (body: SignupRequest) => {
    const res = await authApi.signup(body);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout, refreshUser: setUser }),
    [user, loading, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 는 AuthProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}
