"use client";

import { Check } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export interface StepDef {
  id: number;
  label: string;
}

export function Stepper({
  steps,
  current,
  onStepClick,
  className,
}: {
  steps: StepDef[];
  current: number;
  onStepClick?: (id: number) => void;
  className?: string;
}) {
  const currentStep = steps.find((s) => s.id === current) ?? steps[0];
  const percent = (current / steps.length) * 100;

  return (
    <div className={className}>
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-bold text-ink-900">{currentStep.label}</p>
          <p className="text-xs font-semibold tabular-nums text-ink-400">
            {current} / {steps.length}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full rounded-full bg-primary-600 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ol className="hidden items-center sm:flex">
        {steps.map((step, i) => {
          const done = step.id < current;
          const active = step.id === current;
          const clickable = done && !!onStepClick;
          return (
            <li key={step.id} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(step.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-1.5 py-1 transition-colors",
                  clickable && "hover:bg-ink-100",
                  !clickable && "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    active && "bg-primary-600 text-white",
                    done && "bg-primary-50 text-primary-700",
                    !active && !done && "border border-line bg-white text-ink-300",
                  )}
                >
                  {done ? <Check size={14} strokeWidth={3} /> : step.id}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-[13px] transition-colors",
                    active ? "font-bold text-ink-900" : done ? "font-semibold text-ink-600" : "font-medium text-ink-300",
                  )}
                >
                  {step.label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    "mx-3 h-px flex-1 transition-colors",
                    step.id < current ? "bg-primary-200" : "bg-line",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
