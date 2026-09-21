import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  tone = "default",
  className,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  tone?: "default" | "hero";
  className?: string;
}) {
  const hero = tone === "hero";
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-toss-soft/60 px-6 text-center",
        hero ? "py-20 sm:py-28" : "py-14",
        className,
      )}
    >
      <div className="grid-texture pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative">
        <div
          className={cn(
            "mx-auto flex items-center justify-center rounded-2xl border border-line bg-white text-primary-600 shadow-soft",
            hero ? "h-16 w-16" : "h-14 w-14",
          )}
        >
          <Icon size={hero ? 28 : 24} strokeWidth={1.6} />
        </div>
        <p className={cn("mt-5 font-bold text-ink-900", hero ? "text-xl" : "text-base")}>{title}</p>
        {description && (
          <div className={cn("mt-2 leading-relaxed text-ink-500", hero ? "text-[15px]" : "text-sm")}>
            {description}
          </div>
        )}
        {action && <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function ErrorState({
  title = "불러오지 못했습니다.",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-line bg-white px-6 py-14 text-center shadow-soft",
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-toss-red-soft text-toss-red">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
        </svg>
      </div>
      <p className="mt-4 text-base font-bold text-ink-900">{title}</p>
      {description && <p className="mt-1.5 text-sm text-ink-500">{description}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-10 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink-700 transition hover:bg-ink-100"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
