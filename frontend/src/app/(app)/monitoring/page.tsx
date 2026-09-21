"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bell,
  Cable,
  ChevronDown,
  ChevronRight,
  Cpu,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Server,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { telemetryApi } from "@/services/agentApi";
import { incidentApi } from "@/services/alertApi";
import { dashboardApi, eventApi } from "@/services/dashboardApi";
import { SERIES_COLORS } from "@/features/analysis/severity";
import { IncidentList } from "@/features/monitoring/IncidentList";
import { MetricChart } from "@/features/monitoring/MetricChart";
import { Sparkline, UsageTrendChart, type UsageSeries } from "@/features/monitoring/UsageTrendChart";
import { cn } from "@/shared/lib/cn";
import { formatRelative } from "@/shared/lib/format";
import { koreanDate, koreanTime, useNow } from "@/shared/lib/useNow";
import { Card } from "@/shared/ui/Card";
import { ErrorState } from "@/shared/ui/EmptyState";
import { Skeleton } from "@/shared/ui/Skeleton";
import { Segmented } from "@/shared/ui/Switch";
import { useToast } from "@/shared/ui/Toast";
import type {
  ActivityEvent,
  Agent,
  EventType,
  Incident,
  IncidentStatus,
  MetricSeriesResponse,
  MonitoringOverview,
  SystemStatus,
} from "@/types";

type LoadState = "loading" | "ready" | "error";
type MetricKey = "cpuPct" | "memoryPct" | "diskPct";

const REFRESH_MS = 30_000;
const MAX_PROJECTS = 8;

const METRICS: { key: MetricKey; label: string; title: string; icon: LucideIcon; color: string }[] = [
  { key: "cpuPct", label: "CPU", title: "CPU 사용률", icon: Cpu, color: SERIES_COLORS[0] },
  { key: "memoryPct", label: "메모리", title: "메모리 사용률", icon: MemoryStick, color: SERIES_COLORS[1] },
  { key: "diskPct", label: "디스크", title: "디스크 사용률", icon: HardDrive, color: SERIES_COLORS[2] },
];

const RANGES = [
  { value: 60, label: "최근 1시간" },
  { value: 360, label: "최근 6시간" },
  { value: 1440, label: "최근 24시간" },
];

const SERVER_EVENTS: EventType[] = [
  "AGENT_REGISTERED",
  "AGENT_DELETED",
  "AGENT_CONNECTED",
  "AGENT_DISCONNECTED",
  "INCIDENT_OPENED",
  "INCIDENT_RESOLVED",
  "ALERT_SENT",
  "ALERT_FAILED",
];

export default function MonitoringPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [overview, setOverview] = useState<MonitoringOverview | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentTab, setIncidentTab] = useState<IncidentStatus>("OPEN");
  const [metrics, setMetrics] = useState<Map<number, MetricSeriesResponse>>(new Map());
  const [end, setEnd] = useState(() => Date.now());
  const [range, setRange] = useState(60);
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback((silent = false) => {
    if (!silent) setState("loading");
    setRefreshing(true);
    Promise.all([
      dashboardApi.systemStatus().catch(() => null),
      telemetryApi.overview(),
      eventApi.search({ size: 40 }).catch(() => null),
    ])
      .then(([s, o, e]) => {
        setSystem(s);
        setOverview(o);
        if (e) setEvents(e.items.filter((x) => SERVER_EVENTS.includes(x.type)).slice(0, 5));
        setState("ready");
        setTick((t) => t + 1);
      })
      .catch((err: unknown) => {
        if (silent) return;
        setError(err instanceof Error ? err.message : "모니터링 정보를 불러오지 못했습니다.");
        setState("error");
      })
      .finally(() => setRefreshing(false));
  }, []);

  const loadIncidents = useCallback(() => {
    incidentApi.list({ status: incidentTab, limit: 30 }).then(setIncidents).catch(() => {});
  }, [incidentTab]);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    loadIncidents();
    const timer = setInterval(loadIncidents, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadIncidents]);

  const agentProjects = useMemo(
    () => (overview?.projects ?? []).filter((p) => p.agents.length > 0).slice(0, MAX_PROJECTS).map((p) => p.projectId),
    [overview],
  );
  const projectKey = agentProjects.join(",");

  useEffect(() => {
    if (!projectKey) {
      setMetrics(new Map());
      return;
    }
    let cancelled = false;
    const ids = projectKey.split(",").map(Number);
    Promise.all(ids.map((id) => telemetryApi.metrics(id, range).then((r) => [id, r] as const).catch(() => null))).then((list) => {
      if (cancelled) return;
      setMetrics(new Map(list.filter((x): x is readonly [number, MetricSeriesResponse] => !!x)));
      setEnd(Date.now());
    });
    return () => {
      cancelled = true;
    };
  }, [projectKey, range, tick]);

  const start = end - range * 60_000;
  const bucketSeconds = Array.from(metrics.values())[0]?.bucketSeconds ?? 60;

  const aggregated = useMemo(() => {
    const result = {} as Record<MetricKey, { t: number; v: number }[]>;
    for (const m of METRICS) {
      const buckets = new Map<number, { sum: number; n: number }>();
      for (const res of metrics.values()) {
        for (const s of res.series) {
          for (const p of s.points) {
            const v = p[m.key];
            if (v == null) continue;
            const t = Date.parse(p.time);
            const b = buckets.get(t) ?? { sum: 0, n: 0 };
            b.sum += v;
            b.n += 1;
            buckets.set(t, b);
          }
        }
      }
      result[m.key] = Array.from(buckets.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([t, b]) => ({ t, v: b.sum / b.n }));
    }
    return result;
  }, [metrics]);

  function refresh() {
    load(true);
    loadIncidents();
  }

  if (state === "loading") {
    return (
      <div className="space-y-5">
        <Skeleton className="h-[110px] rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[112px] rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          <Skeleton className="h-[340px] rounded-2xl" />
          <Skeleton className="h-[340px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (state === "error" || !overview) {
    return <ErrorState title="모니터링 정보를 불러오지 못했습니다." description={error} onRetry={() => load()} />;
  }

  const agents = overview.projects.flatMap((p) => p.agents.map((a) => ({ agent: a, project: p })));

  return (
    <div className="space-y-5">
      <Hero overview={overview} system={system} refreshing={refreshing} onRefresh={refresh} />
      <StatCards overview={overview} aggregated={aggregated} start={start} end={end} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <TrendCard
          aggregated={aggregated}
          range={range}
          onRange={setRange}
          start={start}
          end={end}
          bucketSeconds={bucketSeconds}
          hasAgents={agents.length > 0}
        />
        <EventsCard events={events} />
      </div>

      <ServerList agents={agents} metrics={metrics} range={range} end={end} />

      <IncidentsCard
        incidents={incidents}
        tab={incidentTab}
        onTab={setIncidentTab}
        onChanged={() => {
          loadIncidents();
          load(true);
        }}
      />
    </div>
  );
}

function headline(overview: MonitoringOverview, system: SystemStatus | null): { lead: string; accent: string; tone: "blue" | "red" | "amber" } {
  const down = (system?.services ?? []).filter((s) => s.status === "DOWN");
  const offline = overview.agentsTotal - overview.agentsOnline;
  if (overview.openIncidents > 0) return { lead: "지금, 확인이 필요한 이상이 ", accent: `${overview.openIncidents}건 있어요.`, tone: "red" };
  if (down.length) return { lead: "지금, 일부 서비스의 ", accent: "연결이 끊겼어요.", tone: "red" };
  if (overview.agentsTotal === 0) return { lead: "서버에 에이전트를 연결하면 ", accent: "실시간으로 지켜볼게요.", tone: "blue" };
  if (offline > 0) return { lead: "지금, 연결이 끊긴 서버가 ", accent: `${offline}대 있어요.`, tone: "amber" };
  return { lead: "지금, 모든 서비스가 ", accent: "정상적으로 운영되고 있어요.", tone: "blue" };
}

function Hero({
  overview,
  system,
  refreshing,
  onRefresh,
}: {
  overview: MonitoringOverview;
  system: SystemStatus | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const now = useNow();
  const h = headline(overview, system);

  return (
    <section className="flex flex-col gap-4 lg:flex-row lg:items-end">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink-400">모니터링</p>
        <h1 className="mt-1.5 text-[24px] font-extrabold leading-snug tracking-tight text-ink-900 sm:text-[28px]">
          {h.lead}
          <span className={cn(h.tone === "red" ? "text-toss-red" : h.tone === "amber" ? "text-toss-amber" : "text-primary-600")}>
            {h.accent}
          </span>
        </h1>
        <p className="mt-2 text-[14px] text-ink-500">서버 상태와 주요 지표를 실시간으로 확인하고, 이상 징후를 빠르게 파악하세요.</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          {now && (
            <p className="text-[12.5px] font-medium tabular-nums text-ink-500">
              {koreanDate(now)} {koreanTime(now)}
            </p>
          )}
          <p className="mt-0.5 text-[12px] text-ink-400">30초마다 자동 갱신</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-white px-5 text-[14px] font-bold text-primary-600 shadow-soft transition hover:border-primary-600 hover:bg-primary-600 hover:text-white"
        >
          <RefreshCw size={17} strokeWidth={2.4} className={cn(refreshing && "animate-spin")} />
          새로고침
        </button>
      </div>
    </section>
  );
}

function avgLatest(agents: Agent[], key: MetricKey): number | null {
  const values = agents
    .filter((a) => a.state === "ONLINE")
    .map((a) => a.latest?.[key])
    .filter((v): v is number => v != null);
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

function StatCards({
  overview,
  aggregated,
  start,
  end,
}: {
  overview: MonitoringOverview;
  aggregated: Record<MetricKey, { t: number; v: number }[]>;
  start: number;
  end: number;
}) {
  const agents = overview.projects.flatMap((p) => p.agents);
  const offline = overview.agentsTotal - overview.agentsOnline;
  const serverState =
    overview.agentsTotal === 0
      ? { dot: "bg-ink-300", text: "연결된 서버 없음" }
      : offline > 0
        ? { dot: "bg-toss-red", text: `${offline}대 연결 끊김` }
        : { dot: "bg-toss-green", text: "정상 운영 중" };

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,0.8fr)_repeat(3,minmax(0,1fr))]">
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-soft">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.8)]">
          <Server size={24} strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-ink-700">서버</p>
          <p className="mt-1 text-[28px] font-extrabold leading-none tracking-tight tabular-nums text-ink-900">
            {overview.agentsOnline} / {overview.agentsTotal}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-500">
            <span className={cn("h-2 w-2 rounded-full", serverState.dot)} />
            {serverState.text}
          </p>
        </div>
      </div>

      {METRICS.map((m) => {
        const Icon = m.icon;
        const current = avgLatest(agents, m.key);
        const pts = aggregated[m.key];
        const delta = pts.length > 1 ? Math.round(pts[pts.length - 1].v - pts[0].v) : null;
        return (
          <div key={m.key} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-soft">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{ background: m.color }}
            >
              <Icon size={24} strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="whitespace-nowrap text-[14px] font-bold text-ink-700">{m.title}</p>
                <Sparkline points={pts} color={m.color} start={start} end={end} />
              </div>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <span className="text-[28px] font-extrabold leading-none tracking-tight tabular-nums text-ink-900">
                  {current == null ? "-" : `${Math.round(current)}%`}
                </span>
                {delta != null && (
                  <span
                    title="기간 시작 대비"
                    className={cn(
                      "inline-flex items-center text-[12px] font-bold tabular-nums",
                      delta > 0 ? "text-toss-red" : delta < 0 ? "text-toss-green" : "text-ink-400",
                    )}
                  >
                    {delta > 0 ? <ArrowUp size={13} strokeWidth={2.6} /> : delta < 0 ? <ArrowDown size={13} strokeWidth={2.6} /> : null}
                    {delta === 0 ? "변화 없음" : `${Math.abs(delta)}%p`}
                  </span>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrendCard({
  aggregated,
  range,
  onRange,
  start,
  end,
  bucketSeconds,
  hasAgents,
}: {
  aggregated: Record<MetricKey, { t: number; v: number }[]>;
  range: number;
  onRange: (v: number) => void;
  start: number;
  end: number;
  bucketSeconds: number;
  hasAgents: boolean;
}) {
  const [showTable, setShowTable] = useState(false);
  const series: UsageSeries[] = METRICS.map((m) => ({ key: m.key, label: m.label, color: m.color, points: aggregated[m.key] }));

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold text-ink-900">주요 지표 추이</h2>
          <p className="mt-1 text-[12.5px] text-ink-400 [word-break:keep-all]">연결된 서버 전체의 평균 사용률입니다.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="h-9 rounded-lg px-2.5 text-[12px] font-semibold text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
          >
            {showTable ? "그래프" : "표"}
          </button>
          <label className="relative">
            <span className="sr-only">기간</span>
            <select
              value={range}
              onChange={(e) => onRange(Number(e.target.value))}
              className="h-9 appearance-none rounded-lg border border-line bg-white pl-3 pr-8 text-[13px] font-semibold text-ink-700 outline-none transition hover:border-ink-300 focus:border-primary-400"
            >
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          </label>
        </div>
      </div>

      <ul className="mb-2 mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-semibold text-ink-600">
        {METRICS.map((m) => (
          <li key={m.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
            {m.label}
          </li>
        ))}
      </ul>

      {hasAgents ? (
        <UsageTrendChart series={series} start={start} end={end} bucketSeconds={bucketSeconds} showTable={showTable} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
          <Cable size={24} className="text-ink-300" />
          <p className="text-[13px] text-ink-500">에이전트를 연결하면 CPU·메모리·디스크 추이가 표시됩니다.</p>
        </div>
      )}
    </Card>
  );
}

const LEVEL_DOT: Record<ActivityEvent["level"], string> = {
  INFO: "bg-toss-green",
  WARNING: "bg-[#F59E0B]",
  ERROR: "bg-toss-red",
};

function EventsCard({ events }: { events: ActivityEvent[] }) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-bold text-ink-900">최근 이벤트</h2>
        <Link href="/events" className="inline-flex items-center gap-1 text-[13px] font-bold text-primary-600 hover:text-primary-700">
          전체 보기
          <ArrowRight size={14} strokeWidth={2.4} />
        </Link>
      </div>
      {events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
          <ShieldCheck size={24} className="text-ink-300" />
          <p className="text-[13px] text-ink-500">아직 서버 이벤트가 없습니다.</p>
        </div>
      ) : (
        <ul className="mt-3">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-3 border-b border-line py-3 last:border-0">
              <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", LEVEL_DOT[e.level])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink-900">{e.title}</p>
                <p className="mt-0.5 truncate text-[12px] text-ink-400">
                  {[e.message, e.projectName].filter(Boolean).join(" · ") || "-"}
                </p>
              </div>
              <time dateTime={e.createdAt} className="shrink-0 text-[12px] tabular-nums text-ink-400">
                {formatRelative(e.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function serverBadge(agent: Agent): { label: string; className: string } {
  if (agent.state === "OFFLINE") return { label: "연결 끊김", className: "bg-toss-red text-white" };
  if (agent.state === "PENDING") return { label: "연결 대기", className: "bg-ink-400 text-white" };
  const high = METRICS.some((m) => (agent.latest?.[m.key] ?? 0) >= 90);
  return high ? { label: "주의", className: "bg-[#F59E0B] text-white" } : { label: "정상", className: "bg-toss-green text-white" };
}

function ServerList({
  agents,
  metrics,
  range,
  end,
}: {
  agents: { agent: Agent; project: MonitoringOverview["projects"][number] }[];
  metrics: Map<number, MetricSeriesResponse>;
  range: number;
  end: number;
}) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold text-ink-900">서버 자원</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-400">서버를 누르면 {RANGES.find((r) => r.value === range)?.label} 추이를 볼 수 있어요.</p>
        </div>
        <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-ink-400">{agents.length}대</span>
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <Cable size={24} className="text-ink-300" />
          <p className="text-[13px] text-ink-500">아직 연결된 서버가 없습니다. 프로젝트의 에이전트 탭에서 토큰을 발급하고 서버에 설치해주세요.</p>
        </div>
      ) : (
        <ul>
          {agents.map(({ agent, project }) => {
            const badge = serverBadge(agent);
            const expanded = open === agent.id;
            const res = metrics.get(project.projectId);
            const series = (res?.series ?? []).filter((s) => s.agentId === agent.id);
            return (
              <li key={agent.id} className="border-b border-line last:border-0">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : agent.id)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition hover:bg-toss-soft lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))_auto]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full",
                        agent.state === "ONLINE" ? "bg-toss-green" : agent.state === "OFFLINE" ? "bg-toss-red" : "bg-ink-300",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-bold text-ink-900">{agent.name}</span>
                      <span className="block truncate text-[12px] text-ink-400">
                        {project.name}
                        {agent.hostname ? ` · ${agent.hostname}` : ""}
                        {agent.lastSeenAt ? ` · ${formatRelative(agent.lastSeenAt)}` : ""}
                      </span>
                    </span>
                  </span>

                  {METRICS.map((m) => {
                    const v = agent.latest?.[m.key];
                    return (
                      <span key={m.key} className="hidden min-w-0 lg:block">
                        <span className="block text-[12px] font-semibold text-ink-500">{m.label}</span>
                        <span className="mt-1.5 flex items-center gap-2.5">
                          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-100">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${Math.max(0, Math.min(100, v ?? 0))}%`, background: m.color }}
                            />
                          </span>
                          <span className="w-10 shrink-0 text-right text-[13px] font-bold tabular-nums text-ink-900">
                            {v == null ? "-" : `${Math.round(v)}%`}
                          </span>
                        </span>
                      </span>
                    );
                  })}

                  <span className="flex items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold", badge.className)}>
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      {badge.label}
                    </span>
                    <ChevronRight size={17} className={cn("text-ink-400 transition-transform", expanded && "rotate-90")} />
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-line bg-toss-soft px-5 py-4">
                    <div className="grid gap-4 xl:grid-cols-3">
                      {METRICS.map((m) => (
                        <MetricChart
                          key={m.key}
                          title={m.title}
                          metric={m.key}
                          series={series}
                          order={[agent.id]}
                          minutes={range}
                          bucketSeconds={res?.bucketSeconds ?? 60}
                          now={end}
                        />
                      ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Link
                        href={`/projects/${project.projectId}/agents`}
                        className="inline-flex items-center gap-1 text-[13px] font-bold text-primary-600 hover:text-primary-700"
                      >
                        에이전트 관리
                        <ArrowRight size={14} strokeWidth={2.4} />
                      </Link>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const INCIDENT_TABS = [
  { value: "OPEN", label: "진행 중" },
  { value: "RESOLVED", label: "해결됨" },
] as const;

function IncidentsCard({
  incidents,
  tab,
  onTab,
  onChanged,
}: {
  incidents: Incident[];
  tab: IncidentStatus;
  onTab: (tab: IncidentStatus) => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [resolving, setResolving] = useState<number | null>(null);

  async function resolve(incident: Incident) {
    setResolving(incident.id);
    try {
      await incidentApi.resolve(incident.id);
      toast.success("해결 처리했습니다.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "처리하지 못했습니다.");
    } finally {
      setResolving(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold text-ink-900">이상 탐지</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-400">규칙과 평소 추세를 기준으로 1분마다 확인합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings/alerts"
            className="hidden h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 sm:inline-flex"
          >
            <Bell size={14} />
            알림 설정
          </Link>
          <Segmented options={INCIDENT_TABS} value={tab} onChange={onTab} />
        </div>
      </div>
      {incidents.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-toss-green text-white">
            <ShieldCheck size={22} strokeWidth={2} />
          </span>
          <p className="mt-3 text-[14px] font-bold text-ink-900">{tab === "OPEN" ? "지금은 이상이 없습니다" : "해결된 기록이 없습니다"}</p>
          <p className="mt-1 text-[12px] text-ink-400">CPU·메모리·디스크 사용률, 오류 로그 급증, 치명 로그, 연결 끊김을 지켜보고 있어요.</p>
        </div>
      ) : (
        <IncidentList incidents={incidents} onResolve={resolve} resolving={resolving} />
      )}
    </Card>
  );
}
