"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderKanban,
  LayoutDashboard,
  Play,
  type LucideIcon,
} from "lucide-react";
import { EventList } from "@/features/dashboard/EventList";
import { ScoreTrendChart, type ScorePoint } from "@/features/dashboard/ScoreTrendChart";
import { ProjectMenu } from "@/features/project/ProjectMenu";
import { dashboardApi, eventApi } from "@/services/dashboardApi";
import { projectApi } from "@/services/projectApi";
import { cn } from "@/shared/lib/cn";
import { formatRelative } from "@/shared/lib/format";
import { koreanDate, koreanTime, useNow } from "@/shared/lib/useNow";
import { LinkButton } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { EmptyState, ErrorState } from "@/shared/ui/EmptyState";
import { DragScroll } from "@/shared/ui/DragScroll";
import { Skeleton } from "@/shared/ui/Skeleton";
import { ProjectStatusBadge } from "@/shared/ui/StatusBadge";
import type { AnalysisListItem, Dashboard, EventSummary, Project, ProjectHealth, ProjectStatus } from "@/types";

type LoadState = "loading" | "ready" | "error";

const DAY = 86_400_000;

const STATUS_META: Record<ProjectStatus, { label: string; color: string; dot: string }> = {
  ACTIVE: { label: "운영 중", color: "#06A658", dot: "bg-toss-green" },
  ANALYZING: { label: "분석 중", color: "#2563EB", dot: "bg-primary-600" },
  READY: { label: "준비됨", color: "#94A3B8", dot: "bg-ink-400" },
  ERROR: { label: "오류", color: "#E5484D", dot: "bg-toss-red" },
};

export default function OverviewPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<Dashboard | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<EventSummary | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setState("loading");
    Promise.all([
      dashboardApi.dashboard(),
      dashboardApi.analyses(300).catch(() => [] as AnalysisListItem[]),
      projectApi.list().catch(() => [] as Project[]),
      eventApi.summary({ days: 7 }).catch(() => null),
    ])
      .then(([d, a, p, e]) => {
        setData(d);
        setAnalyses(a);
        setProjects(p);
        setEvents(e);
        setState("ready");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "개요를 불러오지 못했습니다.");
        setState("error");
      });
  }, []);

  useEffect(load, [load]);

  if (state === "loading") {
    return (
      <div className="space-y-5">
        <Skeleton className="h-[84px] rounded-2xl" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <Skeleton className="h-[520px] rounded-2xl" />
          <Skeleton className="h-[520px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (state === "error" || !data) {
    return <ErrorState title="개요를 불러오지 못했습니다." description={error} onRetry={load} />;
  }

  return (
    <div className="space-y-5">
      <Hero data={data} />
      {data.projects.total === 0 ? (
        <EmptyState
          tone="hero"
          icon={LayoutDashboard}
          title="아직 등록된 프로젝트가 없습니다."
          description="프로젝트를 등록하고 분석하면 이곳에 전체 현황이 모입니다."
          action={<LinkButton href="/projects" size="lg">프로젝트 등록하기</LinkButton>}
        />
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-5">
              <OperationSummary data={data} />
              <KpiStrip data={data} analyses={analyses} projects={projects} />
            </div>
            <AttentionCard data={data} events={events} />
          </div>
          <TrendCard analyses={analyses} />
        </>
      )}
    </div>
  );
}

type Headline = { emoji: string; lead: string; accent: string; tail: string; tone?: "red" };

function headlines(data: Dashboard | null): Headline[] {
  const list: Headline[] = [
    { emoji: "📊", lead: "프로젝트 운영, ", accent: "한눈에", tail: " 파악하세요." },
    { emoji: "🔍", lead: "이상 징후는 ", accent: "먼저", tail: " 찾아드릴게요." },
    { emoji: "🚀", lead: "분석 결과로 ", accent: "품질을", tail: " 높여보세요." },
    { emoji: "✅", lead: "오늘도 ", accent: "안정적인 운영", tail: "을 응원해요." },
  ];
  const issues = data?.projectHealth.filter((p) => p.status === "ERROR" || (p.critical ?? 0) > 0).length ?? 0;
  if (issues > 0) list.splice(1, 0, { emoji: "🚨", lead: "확인이 필요한 프로젝트가 ", accent: `${issues}개`, tail: " 있어요.", tone: "red" });
  return list;
}

function RollingTitle({ items }: { items: Headline[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % items.length), 3500);
    return () => window.clearInterval(id);
  }, [paused, items.length]);

  const h = items[index % items.length];
  return (
    <h1
      className="relative h-[40px] overflow-hidden text-[24px] font-extrabold leading-[40px] tracking-tight text-ink-900 sm:h-[46px] sm:text-[32px] sm:leading-[46px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span key={index} className="roll-in block truncate">
        <span className="mr-2" aria-hidden>
          {h.emoji}
        </span>
        {h.lead}
        <span className={h.tone === "red" ? "text-toss-red" : "text-primary-600"}>{h.accent}</span>
        {h.tail}
      </span>
    </h1>
  );
}

function Hero({ data }: { data: Dashboard | null }) {
  const now = useNow();
  const items = useMemo(() => headlines(data), [data]);
  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <RollingTitle items={items} />
        <p className="mt-1.5 text-[15px] text-ink-500">오늘 확인할 상태와 변화만 모았습니다.</p>
      </div>
      {now && (
        <div className="shrink-0 sm:border-l sm:border-line sm:pl-8">
          <p className="text-[13px] font-medium text-ink-500">{koreanDate(now)}</p>
          <p className="mt-1 text-[30px] font-extrabold leading-none tracking-tight tabular-nums text-ink-900">{koreanTime(now)}</p>
        </div>
      )}
    </section>
  );
}

function CardTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-extrabold text-ink-900">{title}</h2>
        {description && <p className="mt-1 text-[12.5px] text-ink-400 [word-break:keep-all]">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

function MoreLink({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-0.5 text-[13px] font-bold text-primary-600 hover:text-primary-700">
      전체 보기
      <ChevronRight size={15} strokeWidth={2.4} />
    </Link>
  );
}

function OperationSummary({ data }: { data: Dashboard }) {
  const total = data.projects.total;
  const counts: Record<ProjectStatus, number> = {
    ACTIVE: data.projects.active,
    ANALYZING: data.projects.analyzing,
    READY: data.projects.ready,
    ERROR: data.projects.error,
  };
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const recent = [...data.projectHealth]
    .sort((a, b) => (b.lastAnalyzedAt ? Date.parse(b.lastAnalyzedAt) : 0) - (a.lastAnalyzedAt ? Date.parse(a.lastAnalyzedAt) : 0))
    .slice(0, 3);

  return (
    <Card className="p-5 sm:p-6">
      <CardTitle
        title="운영 요약"
        description="프로젝트의 현재 운영 상태와 진행 현황을 한눈에 확인하세요."
        action={
          <span className="text-[13px] text-ink-500">
            전체 프로젝트 <span className="ml-1 text-[15px] font-extrabold tabular-nums text-ink-900">{total}개</span>
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
        <div className="rounded-xl border border-line p-4">
          <p className="flex items-center gap-2 text-[14px] font-bold text-ink-700">
            <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_META.ACTIVE.dot)} />
            {STATUS_META.ACTIVE.label}
          </p>
          <p className="mt-2 text-[32px] font-extrabold leading-none tracking-tight tabular-nums text-ink-900">{counts.ACTIVE}개</p>
          <p className="mt-2 text-[12.5px] text-ink-500 [word-break:keep-all]">전체의 {pct(counts.ACTIVE)}%가 정상 운영 중입니다.</p>
        </div>
        {(["ANALYZING", "READY", "ERROR"] as const).map((s) => (
          <div key={s} className="flex flex-col justify-center px-4 sm:border-l sm:border-line">
            <p className="flex items-center gap-2 text-[14px] font-bold text-ink-700">
              <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_META[s].dot)} />
              {STATUS_META[s].label}
            </p>
            <p className={cn("mt-2 text-[24px] font-extrabold leading-none tabular-nums", s === "ERROR" && counts[s] ? "text-toss-red" : "text-ink-900")}>
              {counts[s]}개
            </p>
            <p className="mt-1.5 text-[12.5px] tabular-nums text-ink-400">{pct(counts[s])}%</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-ink-100" role="img" aria-label="프로젝트 상태 비율">
          {(["ACTIVE", "ANALYZING", "READY", "ERROR"] as const)
            .filter((s) => counts[s] > 0)
            .map((s) => (
              <span
                key={s}
                title={`${STATUS_META[s].label} ${counts[s]}개 (${pct(counts[s])}%)`}
                className="h-full border-r-2 border-white last:border-r-0"
                style={{ width: `${(counts[s] / total) * 100}%`, background: STATUS_META[s].color }}
              />
            ))}
        </div>
        <span className="w-12 shrink-0 text-right text-[13px] font-bold tabular-nums text-ink-700" title="운영 중 비율">
          {pct(counts.ACTIVE)}%
        </span>
      </div>

      <DragScroll className="mt-5 rounded-xl border border-line">
        <table className="w-full min-w-[620px] whitespace-nowrap text-left">
          <thead>
            <tr className="border-b border-line text-[12px] font-semibold text-ink-500">
              <th className="px-4 py-2.5">프로젝트 이름</th>
              <th className="px-3 py-2.5">프로젝트 코드</th>
              <th className="px-3 py-2.5 text-center">상태</th>
              <th className="px-3 py-2.5 text-center">최근 분석</th>
              <th className="px-3 py-2.5 text-center">품질 점수</th>
              <th className="w-12 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {recent.map((p) => (
              <ProjectRow key={p.projectId} p={p} />
            ))}
          </tbody>
        </table>
      </DragScroll>
    </Card>
  );
}

function ProjectRow({ p }: { p: ProjectHealth }) {
  return (
    <tr className="border-b border-line transition-colors last:border-0 hover:bg-toss-soft">
      <td className="px-4 py-3">
        <Link href={`/projects/${p.projectId}`} className="group flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white">
            <Folder size={15} strokeWidth={2.2} />
          </span>
          <span className="text-[13.5px] font-bold text-ink-900 group-hover:text-primary-600">{p.name}</span>
        </Link>
      </td>
      <td className="px-3 py-3 font-mono text-[12px] text-ink-500">{p.projectCode}</td>
      <td className="px-3 py-3 text-center">
        <ProjectStatusBadge status={p.status} solid />
      </td>
      <td className="px-3 py-3 text-center text-[12.5px] tabular-nums text-ink-500">{formatRelative(p.lastAnalyzedAt)}</td>
      <td className="px-3 py-3 text-center text-[14px] font-extrabold tabular-nums text-primary-600">
        {p.score != null ? `${p.score}점` : <span className="font-normal text-ink-300">-</span>}
      </td>
      <td className="px-2 py-3 text-center">
        <ProjectMenu projectId={p.projectId} name={p.name} />
      </td>
    </tr>
  );
}

// 그날까지 끝난 분석 중 프로젝트별 마지막 점수의 평균
function buildTrend(analyses: AnalysisListItem[], days: number): ScorePoint[] {
  const done = analyses
    .filter((a) => a.status === "COMPLETED" && a.score != null && a.completedAt)
    .map((a) => ({ projectId: a.projectId, t: Date.parse(a.completedAt!), score: a.score! }))
    .sort((a, b) => a.t - b.t);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const first = today.getTime() - (days - 1) * DAY;

  return Array.from({ length: days }, (_, i) => {
    const day = first + i * DAY;
    const latest = new Map<number, number>();
    for (const a of done) {
      if (a.t >= day + DAY) break;
      latest.set(a.projectId, a.score);
    }
    const scores = Array.from(latest.values());
    return {
      day,
      score: scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null,
      projects: scores.length,
    };
  });
}

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

function KpiStrip({ data, analyses, projects }: { data: Dashboard; analyses: AnalysisListItem[]; projects: Project[] }) {
  const now = Date.now();
  const within = (iso: string | null | undefined, ms: number) => !!iso && now - Date.parse(iso) < ms;
  const [yesterday, today] = buildTrend(analyses, 2);
  const scoreDelta = yesterday.score != null && today.score != null ? today.score - yesterday.score : null;
  const week = analyses.filter((a) => within(a.startedAt, 7 * DAY)).length;
  const items: { icon: LucideIcon; tile: string; label: string; value: string; sub: React.ReactNode }[] = [
    {
      icon: FolderKanban,
      tile: "bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8]",
      label: "전체 프로젝트",
      value: `${data.projects.total}`,
      sub: <Delta label="오늘 추가" value={projects.filter((p) => within(p.createdAt, DAY)).length} />,
    },
    {
      icon: BarChart3,
      tile: "bg-toss-green",
      label: "평균 품질 점수",
      value: data.analyses.averageScore == null ? "-" : `${data.analyses.averageScore}점`,
      sub: scoreDelta == null ? <span className="text-ink-400">프로젝트별 최근 분석 기준</span> : <Delta label="전일 대비" value={scoreDelta} />,
    },
    {
      icon: Play,
      tile: "bg-primary-600",
      label: "지난 7일 분석",
      value: `${week}회`,
      sub: <Delta label="최근 24시간" value={analyses.filter((a) => within(a.startedAt, DAY)).length} />,
    },
    {
      icon: FileText,
      tile: "bg-toss-purple",
      label: "등록 파일",
      value: `${data.fileCount.toLocaleString()}개`,
      sub: <span className="text-ink-400">분석 {data.analyses.total}회 · 실패 {data.analyses.failed}회</span>,
    },
  ];

  return (
    <Card className="grid grid-cols-2 gap-y-6 p-5 sm:p-6 lg:grid-cols-4">
      {items.map(({ icon: Icon, tile, label, value, sub }, i) => (
        <div key={label} className={cn("min-w-0 px-3 lg:px-4", i % 2 === 1 && "border-l border-line", i === 2 && "pl-0 lg:border-l lg:border-line lg:pl-4", i === 0 && "pl-0 lg:pl-0")}>
          <div className="flex items-center gap-2.5">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white", tile)}>
              <Icon size={18} strokeWidth={2.2} />
            </span>
            <p className="text-[13px] font-semibold leading-snug text-ink-500 [word-break:keep-all]">{label}</p>
          </div>
          <p className="mt-3 whitespace-nowrap text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-ink-900">{value}</p>
          <p className="mt-2 text-[12px] leading-snug tabular-nums [word-break:keep-all]">{sub}</p>
        </div>
      ))}
    </Card>
  );
}

function Delta({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-ink-400">
      {label}{" "}
      <span className={cn("font-bold", value > 0 ? "text-primary-600" : value < 0 ? "text-toss-red" : "text-ink-500")}>{signed(value)}</span>
    </span>
  );
}

function AttentionCard({ data, events }: { data: Dashboard; events: EventSummary | null }) {
  const issues = data.projectHealth
    .map((p) => ({
      p,
      reason: p.status === "ERROR" ? "마지막 분석이 실패했습니다" : p.critical ? `심각 항목 ${p.critical}건` : null,
    }))
    .filter((x): x is { p: ProjectHealth; reason: string } => x.reason !== null);

  return (
    <Card className="flex flex-col p-5 sm:p-6">
      <CardTitle title="지금 확인할 항목" description="중요한 이벤트와 알림을 확인하세요." action={<MoreLink href="/events" />} />

      {issues.length === 0 ? (
        <div className="flex items-center gap-3.5 rounded-xl border border-line p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-toss-green text-white">
            <CheckCircle2 size={22} strokeWidth={2.4} />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-ink-900">확인할 주요 이슈가 없습니다.</p>
            <p className="mt-0.5 text-[12.5px] text-ink-500">모든 프로젝트가 정상적으로 운영되고 있습니다.</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {issues.slice(0, 3).map(({ p, reason }) => (
            <li key={p.projectId}>
              <Link
                href={p.lastAnalyzedAt ? `/projects/${p.projectId}/analysis` : `/projects/${p.projectId}`}
                className="group flex items-center gap-3 px-4 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-toss-red text-white">
                  <AlertOctagon size={17} strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold text-ink-900">{p.name}</span>
                  <span className="block truncate text-[12.5px] text-toss-red">{reason}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid grid-cols-2 divide-x divide-line">
        {[
          { icon: AlertOctagon, tile: "bg-toss-red", label: "오류", value: events?.error },
          { icon: AlertTriangle, tile: "bg-[#F59E0B]", label: "주의", value: events?.warning },
        ].map(({ icon: Icon, tile, label, value }, i) => (
          <Link key={label} href="/events" className={cn("flex items-center gap-3 py-2", i === 0 ? "pr-4" : "pl-5")}>
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white", tile)}>
              <Icon size={20} strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink-500">{label}</span>
              <span className="block text-[22px] font-extrabold leading-tight tabular-nums text-ink-900">{value ?? "-"}건</span>
              <span className="block text-[12px] text-ink-400">최근 7일 이벤트</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <CardTitle title="최근 활동" action={<MoreLink href="/events" />} />
        {data.recentEvents.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-400">아직 기록된 활동이 없습니다.</p>
        ) : (
          <div className="-mt-3">
            <EventList events={data.recentEvents.slice(0, 4)} compact />
          </div>
        )}
      </div>
    </Card>
  );
}

const RANGES = [
  { days: 7, label: "최근 7일" },
  { days: 14, label: "최근 14일" },
  { days: 30, label: "최근 30일" },
];

function TrendCard({ analyses }: { analyses: AnalysisListItem[] }) {
  const [days, setDays] = useState(7);
  const [showTable, setShowTable] = useState(false);
  const points = useMemo(() => buildTrend(analyses, days), [analyses, days]);

  return (
    <Card className="p-5 sm:p-6">
      <CardTitle
        title="품질 점수 추이"
        description="프로젝트의 품질 점수 변화를 확인할 수 있습니다."
        action={
          <>
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
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="h-9 appearance-none rounded-lg border border-line bg-white pl-3 pr-8 text-[13px] font-semibold text-ink-700 outline-none transition hover:border-ink-300 focus:border-primary-400"
              >
                {RANGES.map((r) => (
                  <option key={r.days} value={r.days}>
                    {r.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
            </label>
          </>
        }
      />
      <ScoreTrendChart points={points} showTable={showTable} />
    </Card>
  );
}
