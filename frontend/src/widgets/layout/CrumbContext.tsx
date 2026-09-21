"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CrumbContext = createContext<{ crumb: string | null; setCrumb: (v: string | null) => void }>({
  crumb: null,
  setCrumb: () => {},
});

export function CrumbProvider({ children }: { children: React.ReactNode }) {
  const [crumb, setCrumb] = useState<string | null>(null);
  const value = useMemo(() => ({ crumb, setCrumb }), [crumb]);
  return <CrumbContext.Provider value={value}>{children}</CrumbContext.Provider>;
}

export function useCrumb() {
  return useContext(CrumbContext);
}

export function useSetCrumb(value: string | null | undefined) {
  const { setCrumb } = useCrumb();
  useEffect(() => {
    setCrumb(value ?? null);
    return () => setCrumb(null);
  }, [value, setCrumb]);
}
