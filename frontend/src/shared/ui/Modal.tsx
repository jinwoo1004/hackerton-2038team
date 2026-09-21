"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-ink-900/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 max-h-[92vh] w-full animate-sheet-up overflow-hidden rounded-t-2xl bg-white shadow-card sm:animate-pop-in sm:rounded-2xl",
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-ink-900">{title}</h3>
            {description && <p className="mt-0.5 text-[13px] text-ink-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-1 rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-900"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5 pb-[calc(env(safe-area-inset-bottom)+0.875rem)] sm:pb-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
