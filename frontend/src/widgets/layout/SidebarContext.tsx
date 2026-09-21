"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);
const KEY = "mp.sidebar.collapsed";

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(KEY) === "1");
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ collapsed, toggle, mobileOpen, setMobileOpen }),
    [collapsed, toggle, mobileOpen],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar 는 SidebarProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}
