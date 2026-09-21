import { cn } from "@/shared/lib/cn";

type Tone = "default" | "blue" | "green" | "amber" | "red";

const toneCls: Record<Tone, string> = {
  default: "text-ink-900",
  blue: "text-primary-700",
  green: "text-toss-green",
  amber: "text-toss-amber",
  red: "text-toss-red",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-4 shadow-soft">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-ink-400">{label}</p>
        <p className={cn("mt-1.5 truncate text-[22px] font-extrabold tabular-nums", toneCls[tone])}>
          {value}
        </p>
        {hint && <p className="mt-0.5 truncate text-[12px] text-ink-400">{hint}</p>}
      </div>
      {icon && <span className="shrink-0 text-ink-300">{icon}</span>}
    </div>
  );
}

export function StatCardRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}
