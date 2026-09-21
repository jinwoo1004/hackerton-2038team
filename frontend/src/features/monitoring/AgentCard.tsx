import { Server, Trash2 } from "lucide-react";
import { formatDateTime, formatRelative } from "@/shared/lib/format";
import { cn } from "@/shared/lib/cn";
import type { Agent } from "@/types";
import { AGENT_STATE, formatPct, formatRate, usageTone } from "./meta";

export function AgentStateBadge({ state }: { state: Agent["state"] }) {
  const m = AGENT_STATE[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold", m.tone)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot, state === "ONLINE" && "animate-pulse")} />
      {m.label}
    </span>
  );
}

function Usage({ label, value }: { label: string; value?: number | null }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="font-semibold text-ink-400">{label}</span>
        <span className="font-bold tabular-nums text-ink-900">{formatPct(value)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", usageTone(value))}
          style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
        />
      </div>
    </div>
  );
}

export function AgentCard({ agent, onDelete }: { agent: Agent; onDelete?: (agent: Agent) => void }) {
  const m = agent.latest;
  const stale = agent.state !== "ONLINE";
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <Server size={19} strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[15px] font-bold text-ink-900">{agent.name}</p>
            <AgentStateBadge state={agent.state} />
          </div>
          <p className="mt-0.5 truncate text-[12px] text-ink-400">
            {[agent.hostname, agent.os].filter(Boolean).join(" · ") || "아직 서버 정보를 받지 못했습니다"}
          </p>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(agent)}
            aria-label={`${agent.name} 삭제`}
            className="-mr-1 rounded-lg p-2 text-ink-300 transition hover:bg-toss-red-soft hover:text-toss-red"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className={cn("mt-5 grid grid-cols-3 gap-4", stale && "opacity-60")}>
        <Usage label="CPU" value={m?.cpuPct} />
        <Usage label="메모리" value={m?.memoryPct} />
        <Usage label="디스크" value={m?.diskPct} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4 text-[12px]">
        <div className="flex justify-between gap-2">
          <dt className="text-ink-400">마지막 수신</dt>
          <dd className="font-semibold tabular-nums text-ink-700" title={formatDateTime(agent.lastSeenAt)}>
            {agent.lastSeenAt ? formatRelative(agent.lastSeenAt) : "-"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-400">네트워크</dt>
          <dd className="font-semibold tabular-nums text-ink-700">
            {m ? `${formatRate(m.netInKbps)} / ${formatRate(m.netOutKbps)}` : "-"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-400">IP</dt>
          <dd className="truncate font-mono text-ink-700">{agent.ipAddress ?? "-"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-400">토큰</dt>
          <dd className="truncate font-mono text-ink-700">{agent.tokenPrefix}...</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-400">버전</dt>
          <dd className="font-semibold text-ink-700">{agent.agentVersion ?? "-"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-400">등록</dt>
          <dd className="font-semibold tabular-nums text-ink-700">{formatDateTime(agent.createdAt).slice(0, 10)}</dd>
        </div>
      </dl>
    </div>
  );
}
