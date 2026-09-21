import { cn } from "@/shared/lib/cn";

export type BadgeTone = "blue" | "green" | "amber" | "red" | "purple" | "gray";

const tones: Record<BadgeTone, string> = {
  blue: "bg-toss-blue-soft text-primary-700",
  green: "bg-toss-green-soft text-toss-green",
  amber: "bg-toss-amber-soft text-toss-amber",
  red: "bg-toss-red-soft text-toss-red",
  purple: "bg-toss-purple-soft text-toss-purple",
  gray: "bg-ink-100 text-ink-500",
};

const dots: Record<BadgeTone, string> = {
  blue: "bg-primary-500",
  green: "bg-toss-green",
  amber: "bg-toss-amber",
  red: "bg-toss-red",
  purple: "bg-toss-purple",
  gray: "bg-ink-400",
};

const solids: Record<BadgeTone, string> = {
  blue: "bg-primary-600 text-white",
  green: "bg-toss-green text-white",
  amber: "bg-[#F59E0B] text-white",
  red: "bg-toss-red text-white",
  purple: "bg-toss-purple text-white",
  gray: "bg-ink-400 text-white",
};

export function Badge({
  children,
  tone = "gray",
  dot = false,
  solid = false,
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  solid?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold",
        solid ? solids[tone] : tones[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", solid ? "bg-white" : dots[tone])} />}
      {children}
    </span>
  );
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-line bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-600",
        className,
      )}
    >
      {children}
    </span>
  );
}
