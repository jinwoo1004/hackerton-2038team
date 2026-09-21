"use client";

import { Check } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export function ChipSelect({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  function toggle(name: string) {
    onChange(value.includes(name) ? value.filter((v) => v !== name) : [...value, name]);
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const selected = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(option)}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-semibold transition-all",
              selected
                ? "border-primary-500 bg-primary-50 text-primary-700"
                : "border-line bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-100",
            )}
          >
            {selected && <Check size={14} strokeWidth={3} className="text-primary-600" />}
            {option}
          </button>
        );
      })}
    </div>
  );
}
