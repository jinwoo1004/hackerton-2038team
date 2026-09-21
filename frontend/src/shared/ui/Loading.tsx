"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { APP } from "@/shared/config/app";
import { LogoMark } from "./Logo";

export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return <Loader2 size={size} className={cn("animate-spin text-primary-600", className)} />;
}

function LoaderMark({ size = 104 }: { size?: number }) {
  return (
    <div className="animate-breathe" aria-hidden>
      <LogoMark size={size} tile />
    </div>
  );
}

function ProgressTrack() {
  return (
    <div className="h-1 w-36 overflow-hidden rounded-full bg-toss-line2">
      <div className="h-full w-2/5 animate-indeterminate rounded-full bg-primary-600" />
    </div>
  );
}

export function PageLoader({ message }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[85] flex items-center justify-center bg-[#FBFCFE]"
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.1),rgba(37,99,235,0))]" />
      <div className="relative flex animate-fade-in flex-col items-center text-center [animation-delay:120ms] [animation-fill-mode:both]">
        <LoaderMark />
        <p className="mt-7 text-[18px] font-extrabold tracking-[-0.02em] text-toss-ink">{APP.name}</p>
        <p className="mt-1.5 text-[14px] font-medium text-toss-sub">{message ?? "화면을 준비하고 있어요"}</p>
        <div className="mt-6">
          <ProgressTrack />
        </div>
      </div>
    </div>
  );
}

export function BlockingOverlay({ title, description }: { title: string; description?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[95] flex animate-fade-in items-center justify-center bg-white/85 px-6 backdrop-blur-md"
    >
      <div className="flex w-full max-w-[420px] flex-col items-center text-center">
        <LoaderMark size={96} />
        <p key={title} className="mt-8 animate-fade-in text-[20px] font-extrabold leading-snug tracking-[-0.03em] text-toss-ink sm:text-[22px]">
          {title}
        </p>
        {description && <p className="mt-2 text-[14px] leading-relaxed text-toss-mid">{description}</p>}
        <div className="mt-7">
          <ProgressTrack />
        </div>
      </div>
    </div>
  );
}
