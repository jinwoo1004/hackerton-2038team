"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Home,
  Loader2,
  PieChart,
  Search,
  TrendingUp,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { dashboardApi } from "@/services/dashboardApi";
import { projectApi } from "@/services/projectApi";
import { AnalysisDetailPanel } from "@/features/analysis/AnalysisDetailPanel";
import { ProjectMenu } from "@/features/project/ProjectMenu";
import { cn } from "@/shared/lib/cn";
import { formatDateTime } from "@/shared/lib/format";
import { Chip } from "@/shared/ui/Badge";
import { LinkButton } from "@/shared/ui/Button";
import { EmptyState, ErrorState } from "@/shared/ui/EmptyState";
import { PageSizeSelect, Pagination } from "@/shared/ui/Pagination";
import { Skeleton } from "@/shared/ui/Skeleton";
import { AnalysisStatusBadge } from "@/shared/ui/StatusBadge";
import type { AnalysisListItem, Project } from "@/types";

type LoadState = "loading" | "ready" | "error";
type StatusFilter = "all" | "COMPLETED" | "RUNNING" | "FAILED";

const WEEK = 7 * 86_400_000;

const isRunning = (a: AnalysisListItem) => a.status === "QUEUED" || a.status === "ANALYZING";

function duration(a: AnalysisListItem): string {
  if (!a.startedAt || !a.completedAt) return "-";
  const sec = Math.max(0, Math.round((Date.parse(a.completedAt) - Date.parse(a.startedAt)) / 1000));
  return sec < 60 ? `${sec}초` : `${Math.floor(sec / 60)}분 ${sec % 60}초`;
}

export default function AnalysisListPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [items, setItems] = useState<AnalysisListItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [project, setProject] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(() => {
    setState("loading");
    Promise.all([dashboardApi.analyses(300), projectApi.list().catch(() => [] as Project[])])
      .then(([list, ps]) => {
        setItems(list);
        setProjects(ps);
        setOpen(list[0]?.id ?? null);
        setState("ready");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "분석 이력을 불러오지 못했습니다.");
        setState("error");
      });
  }, []);

  useEffect(load, [load]);

  const projectOptions = useMemo(() => {
    const map = new Map<number, string>();
    items.forEach((a) => map.set(a.projectId, a.projectName));
    return [...map.entries()];
  }, [items]);

  const techOf = useMemo(() => new Map(projects.map((p) => [p.id, p.technologies.map((t) => t.name)])), [projects]);

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (a) =>
        (project === "all" || String(a.projectId) === project) &&
        (!q || a.projectName.toLowerCase().includes(q) || a.projectCode.toLowerCase().includes(q)),
    );
  }, [items, project, query]);

  const counts = {
    all: scoped.length,
    COMPLETED: scoped.filter((a) => a.status === "COMPLETED").length,
    RUNNING: scoped.filter(isRunning).length,
    FAILED: scoped.filter((a) => a.status === "FAILED").length,
  };

  const filtered = scoped.filter((a) => filter === "all" || (filter === "RUNNING" ? isRunning(a) : a.status === filter));
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * size, current * size + size);

  useEffect(() => setPage(0), [filter, project, query, size]);

  return (
    <>
      <Header />

      {state === "loading" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[104px] rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      )}

      {state === "error" && <ErrorState title="분석 이력을 불러오지 못했습니다." description={error} onRetry={load} />}

      {state === "ready" && items.length === 0 && (
        <EmptyState
          tone="hero"
          icon={Activity}
          title="아직 실행한 분석이 없습니다."
          description="프로젝트 화면에서 분석을 시작하면 이력이 이곳에 쌓입니다."
          action={<LinkButton href="/projects" size="lg">프로젝트로 이동</LinkButton>}
        />
      )}

      {state === "ready" && items.length > 0 && (
        <>
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "전체"],
                  ["COMPLETED", "완료"],
                  ["RUNNING", "진행중"],
                  ["FAILED", "실패"],
                ] as const
              ).map(([key, label]) => {
                const active = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[14px] font-bold transition",
                      active ? "border-primary-600 bg-primary-600 text-white" : "border-line bg-white text-ink-700 hover:border-ink-300",
                    )}
                  >
                    {label}
                    <span
                      className={cn(
                        "min-w-[22px] rounded-full px-1.5 text-center text-[12px] tabular-nums",
                        active ? "bg-white text-primary-700" : "bg-ink-100 text-ink-600",
                      )}
                    >
                      {counts[key]}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row xl:ml-auto">
              <label className="relative">
                <span className="sr-only">프로젝트</span>
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="h-10 w-full appearance-none rounded-xl border border-line bg-white pl-4 pr-10 text-[14px] font-semibold text-ink-700 outline-none transition hover:border-ink-300 focus:border-primary-500 sm:w-52"
                >
                  <option value="all">모든 프로젝트</option>
                  {projectOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
              </label>
              <div className="relative sm:w-72">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="프로젝트 이름 또는 코드 검색"
                  aria-label="분석 검색"
                  className="h-10 w-full rounded-xl border border-line bg-white pl-10 pr-4 text-[14px] text-ink-900 outline-none transition placeholder:text-ink-400 hover:border-ink-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </div>
          </div>

          <StatCards items={scoped} counts={counts} />

          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
            {visible.length === 0 ? (
              <p className="px-5 py-16 text-center text-[13px] text-ink-400">조건에 맞는 분석이 없습니다.</p>
            ) : (
              <ul>
                {visible.map((a) => (
                  <AnalysisRow
                    key={a.id}
                    item={a}
                    tech={techOf.get(a.projectId) ?? []}
                    expanded={open === a.id}
                    onToggle={() => setOpen(open === a.id ? null : a.id)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-[13px] tabular-nums text-ink-500">
              {filtered.length.toLocaleString()}건의 분석 · {new Set(filtered.map((a) => a.projectId)).size}개의 프로젝트
            </p>
            <div className="flex items-center gap-3">
              <Pagination page={current} pages={pages} onPage={setPage} />
              <PageSizeSelect value={size} onChange={setSize} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Header() {
  return (
    <section className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-center">
      <div className="min-w-0 flex-1">
        <nav aria-label="현재 위치" className="flex items-center gap-1.5 text-[13px] font-medium text-ink-400">
          <Link href="/overview" aria-label="개요" className="hover:text-ink-700">
            <Home size={15} />
          </Link>
          <ChevronRight size={14} />
          <span className="text-ink-600">분석</span>
        </nav>
        <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-ink-900 sm:text-[32px]">분석</h1>
        <p className="mt-2 text-[14px] text-ink-500">모든 프로젝트의 분석 이력과 결과를 모아 봅니다.</p>
      </div>

      <div className="relative hidden items-center gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] py-5 pl-5 pr-6 text-white shadow-[0_12px_28px_-14px_rgba(37,99,235,0.75)] sm:flex xl:w-[620px]">
        <span className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-white/10" />
        <span className="relative flex h-[68px] w-[84px] shrink-0 items-center justify-center">
          <span className="absolute left-0 top-2 flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/25">
            <PieChart size={22} strokeWidth={2.2} />
          </span>
          <span className="absolute bottom-0 right-0 flex h-12 w-14 items-center justify-center rounded-xl bg-white text-primary-600 shadow-lift">
            <BarChart3 size={24} strokeWidth={2.4} />
          </span>
        </span>
        <div className="relative min-w-0">
          <p className="text-[15px] font-extrabold leading-snug [word-break:keep-all]">
            코드, 로그, 시스템 데이터를 통합 분석하여
            <br className="hidden xl:block" /> 더 빠른 인사이트를 제공합니다.
          </p>
          <p className="mt-1.5 text-[12.5px] font-medium text-white/85">분석을 펼치면 요약, 코드, 로그, 보안 결과를 바로 볼 수 있습니다.</p>
        </div>
      </div>
    </section>
  );
}

function StatCards({ items, counts }: { items: AnalysisListItem[]; counts: Record<StatusFilter, number> }) {
  const recent = items.filter((a) => a.startedAt && Date.now() - Date.parse(a.startedAt) < WEEK).length;
  const pct = (n: number) => (counts.all ? Math.round((n / counts.all) * 100) : 0);
  const cards: { icon: LucideIcon; tile: string; label: string; value: number; extra: React.ReactNode; hint: string; spin?: boolean }[] = [
    {
      icon: FileText,
      tile: "bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8]",
      label: "전체 분석",
      value: counts.all,
      extra: recent > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[12px] font-bold text-toss-green" title="최근 7일 동안 실행한 분석">
          <TrendingUp size={13} strokeWidth={2.6} />+{recent}
        </span>
      ),
      hint: "분석 실행 수",
    },
    { icon: CheckCircle2, tile: "bg-toss-green", label: "완료", value: counts.COMPLETED, extra: `${pct(counts.COMPLETED)}%`, hint: "분석 완료" },
    { icon: Loader2, tile: "bg-primary-600", label: "진행중", value: counts.RUNNING, extra: `${pct(counts.RUNNING)}%`, hint: "분석 진행 중", spin: counts.RUNNING > 0 },
    { icon: XCircle, tile: "bg-toss-red", label: "실패", value: counts.FAILED, extra: `${pct(counts.FAILED)}%`, hint: "분석 실패" },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
            <span className={cn("hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white sm:flex", c.tile)}>
              <Icon size={24} strokeWidth={2.2} className={cn(c.spin && "animate-spin")} />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-ink-700">{c.label}</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <span className="text-[28px] font-extrabold leading-none tracking-tight tabular-nums text-ink-900">{c.value}</span>
                {typeof c.extra === "string" ? <span className="text-[13px] font-semibold tabular-nums text-ink-400">{c.extra}</span> : c.extra}
              </p>
              <p className="mt-1.5 text-[12.5px] text-ink-500">{c.hint}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnalysisRow({
  item,
  tech,
  expanded,
  onToggle,
}: {
  item: AnalysisListItem;
  tech: string[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="border-b border-line last:border-0">
      <div className="grid grid-cols-1 items-center gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.6fr)_104px_repeat(3,72px)_minmax(0,1fr)_auto] lg:gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white">
            <Folder size={21} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <Link href={`/projects/${item.projectId}`} className="block truncate text-[15px] font-extrabold text-ink-900 hover:text-primary-600">
              {item.projectName}
            </Link>
            <p className="mt-0.5 flex min-w-0 items-center gap-2">
              <span className="truncate font-mono text-[12px] text-ink-400">{item.projectCode}</span>
              {tech.slice(0, 2).map((t) => (
                <Chip key={t} className="hidden sm:inline-flex">{t}</Chip>
              ))}
            </p>
          </div>
        </div>

        <span className="hidden lg:block">
          <AnalysisStatusBadge status={item.status} solid />
        </span>

        <Metric label="품질 점수">
          {item.score != null ? (
            <span className="text-primary-600">
              {item.score}
              <span className="ml-1 text-[14px]">{item.grade}</span>
            </span>
          ) : (
            <span className="text-ink-300">-</span>
          )}
        </Metric>
        <Metric label="심각">
          <span className={item.critical ? "text-toss-red" : undefined}>{item.critical ?? "-"}</span>
        </Metric>
        <Metric label="주의">
          <span className={item.warning ? "text-toss-amber" : undefined}>{item.warning ?? "-"}</span>
        </Metric>

        <span className="hidden text-[13px] tabular-nums text-ink-500 lg:block">
          {formatDateTime(item.startedAt)}
          <span className="block text-[12px] text-ink-400">소요 {duration(item)}</span>
        </span>

        <div className="flex items-center gap-1.5">
          <span className="mr-auto flex items-center gap-2.5 lg:hidden">
            <AnalysisStatusBadge status={item.status} solid />
            {item.score != null && (
              <span className="text-[14px] font-extrabold tabular-nums text-primary-600">
                {item.score} {item.grade}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className={cn(
              "inline-flex h-10 w-[92px] items-center justify-center rounded-xl text-[13.5px] font-bold transition",
              expanded ? "border border-line bg-white text-ink-700 hover:bg-ink-100" : "bg-primary-600 text-white hover:bg-primary-700",
            )}
          >
            {expanded ? "접기" : "결과 보기"}
          </button>
          <ProjectMenu projectId={item.projectId} name={item.projectName} />
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5">
          <AnalysisDetailPanel item={item} />
        </div>
      )}
    </li>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="hidden text-center lg:block">
      <span className="block text-[18px] font-extrabold leading-tight tabular-nums text-ink-900">{children}</span>
      <span className="mt-0.5 block text-[12px] text-ink-400">{label}</span>
    </span>
  );
}
