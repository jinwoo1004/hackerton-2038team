"use client";

import { cn } from "@/shared/lib/cn";

export function Switch({
  checked,
  onChange,
  disabled,
  label,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary-600" : "bg-ink-200",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block h-[22px] w-[22px] rounded-full bg-white shadow-[0_2px_6px_rgba(15,23,42,0.2)] transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-xl bg-ink-100 p-1", className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-8 rounded-lg px-3 text-[13px] font-semibold transition",
            value === o.value ? "bg-white text-ink-900 shadow-soft" : "text-ink-500 hover:text-ink-800",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
