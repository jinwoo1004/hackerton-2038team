import { cn } from "@/shared/lib/cn";
import type { ServiceState } from "@/types";

const META: Record<ServiceState, { label: string; tone: string }> = {
  UP: { label: "정상", tone: "bg-toss-green text-white" },
  DOWN: { label: "응답 없음", tone: "bg-toss-red text-white" },
  DEGRADED: { label: "일부 끊김", tone: "bg-[#F59E0B] text-white" },
  DISABLED: { label: "꺼짐", tone: "bg-ink-400 text-white" },
  NOT_CONNECTED: { label: "미연결", tone: "bg-ink-400 text-white" },
  MOCK: { label: "데모", tone: "bg-primary-600 text-white" },
};

export function ServiceBadge({ status }: { status: ServiceState }) {
  const m = META[status] ?? META.NOT_CONNECTED;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold", m.tone)}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-white", status === "UP" && "animate-pulse")} />
      {m.label}
    </span>
  );
}
