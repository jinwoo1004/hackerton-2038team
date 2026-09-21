"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons = { success: CheckCircle2, error: AlertCircle, info: Info } as const;
const toneCls: Record<ToastTone, string> = {
  success: "text-toss-green",
  error: "text-toss-red",
  info: "text-primary-600",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3600);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (m: string) => show(m, "success"),
      error: (m: string) => show(m, "error"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[90] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:items-end">
        {items.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-2.5 rounded-xl border border-line bg-white px-4 py-3 shadow-card"
            >
              <Icon size={18} className={cn("mt-0.5 shrink-0", toneCls[t.tone])} />
              <p className="flex-1 text-sm font-medium leading-snug text-ink-900">{t.message}</p>
              <button
                type="button"
                aria-label="알림 닫기"
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
                className="-mr-1 rounded-md p-0.5 text-ink-300 transition hover:text-ink-600"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast 는 ToastProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}
