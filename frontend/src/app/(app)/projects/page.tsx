"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Code2, Folder, LayoutGrid, List, Plus, Search, TrendingUp } from "lucide-react";
import { projectApi } from "@/services/projectApi";
import { FirstProjectOnboarding } from "@/features/project/FirstProjectOnboarding";
import { NewProjectCard, ProjectCard } from "@/features/project/ProjectCard";
import { ProjectMenu } from "@/features/project/ProjectMenu";
import { DemoControl } from "@/features/monitoring/DemoControl";
import { DATA_CHANGED } from "@/services/demoApi";
import { cn } from "@/shared/lib/cn";
import { formatDate, formatRelative } from "@/shared/lib/format";
import { Button } from "@/shared/ui/Button";
import { EmptyState, ErrorState } from "@/shared/ui/EmptyState";
import { ProjectCardSkeleton, Skeleton } from "@/shared/ui/Skeleton";
import { ProjectStatusBadge } from "@/shared/ui/StatusBadge";
import type { Project, ProjectStatus } from "@/types";

type Status = "loading" | "ready" | "error";
type View = "grid" | "list";
type Sort = "created" | "analyzed" | "name";

const VIEW_KEY = "mp.projects.view";
const WEEK = 7 * 86_400_000;

const STATUS_OPTIONS: { value: ProjectStatus | ""; label: string }[] = [
  { value: "", label: "전체 상태" },
  { value: "ACTIVE", label: "운영중" },
  { value: "ANALYZING", label: "분석중" },
  { value: "READY", label: "준비됨" },
  { value: "ERROR", label: "오류" },
];

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "created", label: "최근 생성순" },
  { value: "analyzed", label: "최근 분석순" },
  { value: "name", label: "이름순" },
];

export default function ProjectsPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<ProjectStatus | "">("");
  const [tech, setTech] = useState("");
  const [sort, setSort] = useState<Sort>("created");
  const [view, setView] = useState<View>("grid");

  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "list") setView("list");
    } catch {}
  }, []);

  function changeView(next: View) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {}
  }

  const load = useCallback(() => {
    setStatus("loading");
    projectApi
      .list()
      .then((list) => {
        setProjects(list);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "프로젝트를 불러오지 못했습니다.");
        setStatus("error");
      });
  }, []);

  useEffect(load, [load]);
  useEffect(() => { window.addEventListener(DATA_CHANGED, load); return () => window.removeEventListener(DATA_CHANGED, load); }, [load]);

  const techOptions = useMemo(
    () => Array.from(new Set(projects.flatMap((p) => p.technologies.map((t) => t.name)))).sort((a, b) => a.localeCompare(b)),
    [projects],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = projects.filter(
      (p) =>
        (!stateFilter || p.status === stateFilter) &&
        (!tech || p.technologies.some((t) => t.name === tech)) &&
        (!q ||
          [p.name, p.nickname, p.projectCode, p.description]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))),
    );
    const time = (v?: string | null) => (v ? Date.parse(v) : 0);
    return list.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "analyzed"
          ? time(b.lastAnalyzedAt) - time(a.lastAnalyzedAt)
          : time(b.createdAt) - time(a.createdAt),
    );
  }, [projects, query, stateFilter, tech, sort]);

  const filtering = !!(query.trim() || stateFilter || tech);
  const isFirstTime = status === "ready" && projects.length === 0;

  function resetFilters() {
    setQuery("");
    setStateFilter("");
    setTech("");
  }

  if (isFirstTime) return <FirstProjectOnboarding />;

  return (
    <>
      <Header />
      <div className="mb-5"><DemoControl /></div>

      {status === "loading" && (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[118px] rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        </>
      )}

      {status === "error" && (
        <ErrorState title="프로젝트를 불러오지 못했습니다." description={error || "잠시 후 다시 시도해주세요."} onRetry={load} />
      )}

      {status === "ready" && projects.length > 0 && (
        <>
          <Summary projects={projects} />

          <div className="mb-5 flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1 lg:max-w-[560px]">
              <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="프로젝트 이름 또는 코드로 검색"
                aria-label="프로젝트 검색"
                className="h-11 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-[14px] text-ink-900 outline-none transition placeholder:text-ink-400 hover:border-ink-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <FilterSelect label="상태" value={stateFilter} onChange={(v) => setStateFilter(v as ProjectStatus | "")} options={STATUS_OPTIONS} />
              <FilterSelect
                label="기술 스택"
                value={tech}
                onChange={setTech}
                options={[{ value: "", label: "전체 기술스택" }, ...techOptions.map((t) => ({ value: t, label: t }))]}
              />
              <FilterSelect label="정렬" value={sort} onChange={(v) => setSort(v as Sort)} options={SORT_OPTIONS} />
              <div className="flex h-11 overflow-hidden rounded-xl border border-line bg-white" role="group" aria-label="보기 방식">
                {(
                  [
                    { value: "grid", icon: LayoutGrid, label: "카드로 보기" },
                    { value: "list", icon: List, label: "목록으로 보기" },
                  ] as const
                ).map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={label}
                    aria-pressed={view === value}
                    onClick={() => changeView(value)}
                    className={cn(
                      "flex w-11 items-center justify-center transition",
                      view === value ? "bg-primary-600 text-white" : "text-ink-400 hover:bg-ink-100 hover:text-ink-700",
                    )}
                  >
                    <Icon size={18} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="조건에 맞는 프로젝트가 없습니다."
              description="검색어나 필터를 바꿔보세요."
              action={
                <Button variant="secondary" onClick={resetFilters}>
                  필터 초기화
                </Button>
              }
            />
          ) : view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
              {!filtering && <NewProjectCard />}
            </div>
          ) : (
            <ProjectList projects={filtered} />
          )}
        </>
      )}

      {status === "ready" && projects.length > 0 && (
        <Link
          href="/projects/new"
          aria-label="새 프로젝트 만들기"
          className="fixed bottom-6 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-cta transition hover:bg-primary-700 sm:hidden"
        >
          <Plus size={24} strokeWidth={2.5} />
        </Link>
      )}
    </>
  );
}

function Header() {
  return (
    <section className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink-400">프로젝트</p>
        <h1 className="mt-1 text-[28px] font-extrabold tracking-tight text-ink-900 sm:text-[32px]">프로젝트</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-500">
          어떤 프로젝트를 분석할까요?
          <br className="hidden sm:block" /> 등록된 프로젝트를 선택하거나 새로운 프로젝트를 만들어 분석을 시작하세요.
        </p>
      </div>

      <div className="relative hidden items-center gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] py-4 pl-5 pr-4 text-white shadow-[0_12px_28px_-14px_rgba(37,99,235,0.75)] sm:flex xl:w-[620px]">
        <span className="pointer-events-none absolute -left-6 -top-10 h-32 w-32 rounded-full bg-white/10" />
        <span className="relative flex h-[68px] w-[76px] shrink-0 items-center justify-center">
          <span className="absolute left-0 top-1 flex h-12 w-12 flex-col justify-center gap-1.5 rounded-xl bg-white/20 px-2.5 ring-1 ring-white/25">
            <span className="h-1 w-5 rounded-full bg-white/80" />
            <span className="h-1 w-3.5 rounded-full bg-white/60" />
          </span>
          <span className="absolute bottom-0 right-0 flex h-12 w-14 items-center justify-center rounded-xl bg-white text-primary-600 shadow-lift">
            <Code2 size={22} strokeWidth={2.4} />
          </span>
        </span>
        <div className="relative min-w-0 flex-1">
          <p className="text-[15px] font-extrabold leading-snug">
            프로젝트를 등록하면
            <br />
            코드와 로그 분석이 시작됩니다.
          </p>
          <p className="mt-1.5 text-[12.5px] font-medium text-white/85">지금 새로운 프로젝트를 만들어보세요!</p>
        </div>
        <Link
          href="/projects/new"
          className="relative flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-white px-5 text-[15px] font-bold text-primary-700 shadow-soft transition hover:bg-primary-50"
        >
          <Plus size={18} strokeWidth={2.6} />새 프로젝트
        </Link>
      </div>
    </section>
  );
}

function Summary({ projects }: { projects: Project[] }) {
  const total = projects.length;
  const count = (s: ProjectStatus) => projects.filter((p) => p.status === s).length;
  const recent = projects.filter((p) => Date.now() - Date.parse(p.createdAt) < WEEK).length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const items = [
    { label: "운영중", value: count("ACTIVE"), dot: "bg-toss-green", text: "text-toss-green", hint: "초기 분석을 마친 프로젝트" },
    { label: "분석중", value: count("ANALYZING"), dot: "bg-primary-600", text: "text-primary-600", hint: "분석이 진행 중인 프로젝트" },
    { label: "오류", value: count("ERROR"), dot: "bg-toss-red", text: "text-toss-red", hint: "문제가 발생한 프로젝트" },
  ];

  return (
    <div className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      <div className="col-span-3 flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-soft sm:col-span-1">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.8)]">
          <Folder size={24} strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-primary-600">전체 프로젝트</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-[28px] font-extrabold leading-none tracking-tight tabular-nums text-ink-900">{total}</span>
            {recent > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[12px] font-bold text-toss-green" title="최근 7일 동안 새로 만든 프로젝트">
                <TrendingUp size={13} strokeWidth={2.6} />+{recent}
              </span>
            )}
          </p>
          <p className="mt-2 text-[12.5px] text-ink-500">등록된 프로젝트 수</p>
        </div>
      </div>

      {items.map((it) => (
        <div key={it.label} className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
          <p className={cn("flex items-center gap-2 text-[14px] font-bold", it.text)}>
            <span className={cn("h-2.5 w-2.5 rounded-full", it.dot)} />
            {it.label}
          </p>
          <p className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[28px] font-extrabold leading-none tracking-tight tabular-nums text-ink-900">{it.value}</span>
            <span className="text-[13px] font-semibold tabular-nums text-ink-400">{pct(it.value)}%</span>
          </p>
          <p className="mt-2 hidden text-[12.5px] text-ink-500 sm:block">{it.hint}</p>
        </div>
      ))}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 appearance-none rounded-xl border bg-white pl-4 pr-10 text-[14px] font-semibold outline-none transition hover:border-ink-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20",
          value && label !== "정렬" ? "border-primary-500 text-primary-700" : "border-line text-ink-700",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
    </label>
  );
}

function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left">
          <thead>
            <tr className="border-b border-line bg-toss-soft text-[12px] font-semibold text-ink-500">
              <th className="px-5 py-3">프로젝트</th>
              <th className="px-3 py-3 text-center">상태</th>
              <th className="px-3 py-3">기술 스택</th>
              <th className="px-3 py-3 text-center">등록 파일</th>
              <th className="px-3 py-3 text-center">최근 분석</th>
              <th className="px-3 py-3 text-center">생성일</th>
              <th className="px-5 py-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const names = p.technologies.map((t) => t.name);
              return (
                <tr key={p.id} className="border-b border-line transition-colors last:border-0 hover:bg-toss-soft">
                  <td className="px-5 py-3.5">
                    <Link href={`/projects/${p.id}`} className="group flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white">
                        <Folder size={18} strokeWidth={2.2} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-bold text-ink-900 group-hover:text-primary-600">{p.name}</span>
                        <span className="block truncate font-mono text-[12px] text-ink-400">{p.projectCode}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <ProjectStatusBadge status={p.status} solid />
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-3.5 text-[13px] text-ink-600">
                    {names.length ? names.slice(0, 3).join(", ") + (names.length > 3 ? ` 외 ${names.length - 3}` : "") : "-"}
                  </td>
                  <td className="px-3 py-3.5 text-center text-[13px] tabular-nums text-ink-600">{p.fileCount}건</td>
                  <td className="px-3 py-3.5 text-center text-[13px] tabular-nums text-ink-600">
                    {p.lastAnalyzedAt ? formatRelative(p.lastAnalyzedAt) : "분석 전"}
                  </td>
                  <td className="px-3 py-3.5 text-center text-[13px] tabular-nums text-ink-600">{formatDate(p.createdAt)}</td>
                  <td className="px-5 py-3.5 text-center">
                    <ProjectMenu projectId={p.id} name={p.name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
