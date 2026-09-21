import { cn } from "@/shared/lib/cn";
import { LogoMark } from "@/shared/ui/Logo";

export const TEAM_TITLE = "2026 개발자리그 해커톤 2038 TEAM";

const TEAM = ["이진우", "최준호", "정슬기", "윤지호"];

export function TeamBrand({
  logoSize = 34,
  compact = false,
  className,
}: {
  logoSize?: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center", compact ? "gap-2" : "gap-2.5", className)}>
      <LogoMark size={logoSize} />
      <div className="min-w-0">
        <p
          className={cn(
            "font-extrabold leading-tight tracking-tight text-ink-900",
            compact ? "text-[12px] tracking-[-0.02em]" : "text-[15px]",
          )}
        >
          {TEAM_TITLE}
        </p>
        <ul
          className={cn(
            "mt-0.5 flex flex-wrap items-center font-medium leading-tight text-toss-sub",
            compact ? "text-[11px]" : "text-[12px]",
          )}
          aria-label="2038 TEAM"
        >
          {TEAM.map((name, i) => (
            <li key={name} className="inline-flex items-center">
              {name}
              {i < TEAM.length - 1 && <span className="mr-1">,</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
