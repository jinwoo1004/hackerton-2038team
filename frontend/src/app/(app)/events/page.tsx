"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, Bell, ChevronDown, ChevronRight, FileText, Info, Play, Search, XOctagon } from "lucide-react";
import { eventApi } from "@/services/dashboardApi";
import { projectApi } from "@/services/projectApi";
import { LEVEL_META, TYPE_ICON, TYPE_TEXT, eventLink } from "@/features/dashboard/EventList";
import { projectLinks } from "@/features/project/ProjectMenu";
import { cn } from "@/shared/lib/cn";
import { formatDateTime } from "@/shared/lib/format";
import { Badge, type BadgeTone } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { EmptyState, ErrorState } from "@/shared/ui/EmptyState";
import { Modal } from "@/shared/ui/Modal";
import { PageSizeSelect, Pagination } from "@/shared/ui/Pagination";
import { Skeleton } from "@/shared/ui/Skeleton";
import type { ActivityEvent, EventLevel, EventSummary, Project } from "@/types";

type LoadState = "loading" | "ready" | "error";
type LevelFilter = EventLevel | "all";

const LEVEL_TONE: Record<EventLevel, BadgeTone> = { INFO: "blue", WARNING: "amber", ERROR: "red" };
const LEVEL_ICON: Record<EventLevel, string> = { INFO: "text-primary-600", WARNING: "text-[#D97706]", ERROR: "text-toss-red" };

const PERIODS = [
  { value: 1, label: "오늘" },
  { value: 7, label: "최근 7일" },
  { value: 30, label: "최근 30일" },
  { value: 0, label: "전체 기간" },
];

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

function splitTime(iso: string) {
  const [date, time] = formatDateTime(iso).split(" ");
  const sec = String(new Date(iso).getSeconds()).padStart(2, "0");
  return { date, time: time ? `${time}:${sec}` : "" };
}

export default function EventsPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [projectId, setProjectId] = useState("all");
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState("");
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [detail, setDetail] = useState<ActivityEvent | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; event: ActivityEvent } | null>(null);
  const q = useDebounced(search);

  useEffect(() => {
    projectApi.list().then(setProjects).catch(() => {});
  }, []);

  const scope = useMemo(
    () => ({ projectId: projectId === "all" ? undefined : Number(projectId), days: days || undefined, q: q || undefined }),
    [projectId, days, q],
  );

  useEffect(() => setPage(0), [scope, level, size, asc]);

  useEffect(() => {
    eventApi.summary(scope).then(setSummary).catch(() => setSummary(null));
  }, [scope]);

  const load = useCallback(() => {
    setState((s) => (s === "ready" ? s : "loading"));
    eventApi
      .search({ ...scope, level: level === "all" ? undefined : level, sort: asc ? "asc" : "desc", page, size })
      .then((res) => {
        setEvents(res.items);
        setTotal(res.total);
        setState("ready");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "이벤트를 불러오지 못했습니다.");
        setState("error");
      });
  }, [scope, level, asc, page, size]);

  useEffect(load, [load]);

  const codeOf = useMemo(() => new Map(projects.map((p) => [p.id, p.projectCode])), [projects]);
  const pages = Math.max(1, Math.ceil(total / size));
  const filtering = level !== "all" || projectId !== "all" || !!q || days !== 0;
  const nothingAtAll = state === "ready" && total === 0 && summary?.total === 0 && !q && projectId === "all" && days === 0;

  return (
    <>
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-extrabold tracking-tight text-ink-900 sm:text-[32px]">이벤트</h1>
          <p className="mt-2 text-[14px] text-ink-500 [word-break:keep-all]">
            프로젝트, 분석, 에이전트, 이상 탐지와 알림 발송을 시간순으로 기록합니다.
          </p>
        </div>
        <FilterSelect
          label="프로젝트"
          value={projectId}
          onChange={setProjectId}
          options={[{ value: "all", label: "모든 프로젝트" }, ...projects.map((p) => ({ value: String(p.id), label: p.name }))]}
        />
      </section>

      <StatCards summary={summary} />

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "전체", summary?.total],
              ["ERROR", "오류", summary?.error],
              ["WARNING", "주의", summary?.warning],
              ["INFO", "정보", summary?.info],
            ] as const
          ).map(([key, label, count]) => {
            const active = level === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setLevel(key)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[14px] font-bold transition",
                  active ? "border-primary-600 bg-primary-600 text-white" : "border-line bg-white text-ink-700 hover:border-ink-300",
                )}
              >
                {label}
                <span className={cn("min-w-[22px] rounded-full px-1.5 text-center text-[12px] tabular-nums", active ? "bg-white text-primary-700" : "bg-ink-100 text-ink-600")}>
                  {count ?? "-"}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row xl:ml-auto">
          <FilterSelect
            label="기간"
            value={String(days)}
            onChange={(v) => setDays(Number(v))}
            options={PERIODS.map((p) => ({ value: String(p.value), label: p.label }))}
          />
          <div className="relative sm:w-80">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이벤트 내용을 검색하세요"
              aria-label="이벤트 검색"
              className="h-10 w-full rounded-xl border border-line bg-white pl-10 pr-4 text-[14px] text-ink-900 outline-none transition placeholder:text-ink-400 hover:border-ink-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>
      </div>

      {state === "loading" && <Skeleton className="h-96 rounded-2xl" />}
      {state === "error" && <ErrorState title="이벤트를 불러오지 못했습니다." description={error} onRetry={load} />}

      {nothingAtAll && (
        <EmptyState
          tone="hero"
          icon={Bell}
          title="아직 기록된 이벤트가 없습니다."
          description="프로젝트를 만들거나 파일을 올리고 분석을 실행하면 자동으로 기록됩니다."
        />
      )}

      {state === "ready" && !nothingAtAll && (
        <>
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="border-b border-line bg-toss-soft text-[12.5px] font-semibold text-ink-500">
                    <th className="w-[210px] px-5 py-3">
                      <button
                        type="button"
                        onClick={() => setAsc((v) => !v)}
                        className="inline-flex items-center gap-1 hover:text-ink-900"
                        aria-label={asc ? "최신순으로 보기" : "오래된 순으로 보기"}
                      >
                        시간
                        {asc ? <ArrowUp size={13} strokeWidth={2.6} /> : <ArrowDown size={13} strokeWidth={2.6} />}
                      </button>
                    </th>
                    <th className="w-[84px] px-3 py-3">구분</th>
                    <th className="px-3 py-3">이벤트 내용</th>
                    <th className="w-[190px] px-3 py-3">프로젝트</th>
                    <th className="w-[200px] px-3 py-3">서버/대상</th>
                    <th className="w-[56px] px-5 py-3">
                      <span className="sr-only">상세</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center text-[13px] text-ink-400">
                        {filtering ? "조건에 맞는 이벤트가 없습니다. 기간을 늘리거나 검색어를 바꿔보세요." : "이벤트가 없습니다."}
                      </td>
                    </tr>
                  )}
                  {events.map((e) => {
                    const Icon = TYPE_ICON[e.type] ?? Play;
                    const t = splitTime(e.createdAt);
                    return (
                      <tr
                        key={e.id}
                        tabIndex={0}
                        aria-label={`${e.title} 상세 보기`}
                        onClick={() => setDetail(e)}
                        onContextMenu={(ev) => {
                          ev.preventDefault();
                          setMenu({ x: ev.clientX, y: ev.clientY, event: e });
                        }}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault();
                            setDetail(e);
                          }
                        }}
                        className="group cursor-pointer border-b border-line outline-none transition-colors last:border-0 hover:bg-toss-soft focus-visible:bg-primary-50"
                      >
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-3.5">
                            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white", LEVEL_ICON[e.level])}>
                              <Icon size={20} strokeWidth={2} />
                            </span>
                            <span className="text-[13px] leading-snug tabular-nums text-ink-700">
                              {t.date}
                              <span className="block text-ink-500">{t.time}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <Badge tone={LEVEL_TONE[e.level]} solid>
                            {LEVEL_META[e.level].label}
                          </Badge>
                        </td>
                        <td className="px-3 py-4">
                          <p className="text-[14px] font-bold text-ink-900">{e.title}</p>
                          <p className="mt-0.5 text-[12.5px] text-ink-500">{TYPE_TEXT[e.type]}</p>
                        </td>
                        <td className="px-3 py-4">
                          {e.projectName ? (
                            <>
                              <p className="truncate text-[13.5px] font-bold text-ink-900">{e.projectName}</p>
                              <p className="truncate font-mono text-[11.5px] text-ink-400">{(e.projectId && codeOf.get(e.projectId)) || "-"}</p>
                            </>
                          ) : (
                            <span className="text-ink-300">-</span>
                          )}
                        </td>
                        <td className="max-w-[200px] px-3 py-4">
                          <p className="line-clamp-2 break-all text-[13px] text-ink-700" title={e.message ?? undefined}>
                            {e.message || "-"}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <ChevronRight size={18} className="ml-auto text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-[13px] tabular-nums text-ink-500">총 {total.toLocaleString()}개의 이벤트</p>
            <div className="flex items-center gap-3">
              <Pagination page={Math.min(page, pages - 1)} pages={pages} onPage={setPage} />
              <PageSizeSelect value={size} onChange={setSize} />
            </div>
          </div>
        </>
      )}

      {menu && (
        <RowContextMenu
          x={menu.x}
          y={menu.y}
          event={menu.event}
          onDetail={() => {
            setDetail(menu.event);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}

      <EventDetail event={detail} code={detail?.projectId ? codeOf.get(detail.projectId) : undefined} onClose={() => setDetail(null)} />
    </>
  );
}

function RowContextMenu({
  x,
  y,
  event,
  onDetail,
  onClose,
}: {
  x: number;
  y: number;
  event: ActivityEvent;
  onDetail: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const related = eventLink(event);
  const links = event.projectId && event.type !== "PROJECT_DELETED" ? projectLinks(event.projectId) : [];
  const width = 200;
  const height = 44 + (related ? 40 : 0) + links.length * 38 + (links.length ? 17 : 0);
  const left = Math.min(x, window.innerWidth - width - 8);
  const top = Math.min(y, window.innerHeight - height - 8);
  const item = "block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-ink-700 transition hover:bg-ink-100 hover:text-ink-900";

  return (
    <>
      <div
        className="fixed inset-0 z-[60]"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        role="menu"
        className="fixed z-[61] animate-pop-in overflow-hidden rounded-xl border border-line bg-white p-1 shadow-card"
        style={{ left, top, width }}
      >
        <button type="button" role="menuitem" onClick={onDetail} className={cn(item, "font-bold text-ink-900")}>
          상세 보기
        </button>
        {related && (
          <Link href={related} role="menuitem" onClick={onClose} className={item}>
            관련 화면으로
          </Link>
        )}
        {links.length > 0 && (
          <>
            <div className="my-1 border-t border-line" />
            {links.map((l) => (
              <Link key={l.href} href={l.href} role="menuitem" onClick={onClose} className={item}>
                {l.label}
              </Link>
            ))}
          </>
        )}
      </div>
    </>
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
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full appearance-none rounded-xl border border-line bg-white pl-4 pr-10 text-[14px] font-semibold text-ink-700 outline-none transition hover:border-ink-300 focus:border-primary-500 sm:w-44"
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

function StatCards({ summary }: { summary: EventSummary | null }) {
  const total = summary?.total ?? 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const delta = summary ? summary.last24h - summary.prev24h : 0;
  const cards = [
    {
      icon: FileText,
      tile: "bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8]",
      label: "전체 이벤트",
      labelClass: "text-ink-700",
      value: total,
      extra:
        summary && delta !== 0 ? (
          <span
            className={cn("inline-flex items-center gap-0.5 text-[13px] font-bold tabular-nums", delta > 0 ? "text-toss-green" : "text-ink-400")}
            title="최근 24시간과 그 전 24시간 비교"
          >
            {delta > 0 ? <ArrowUp size={13} strokeWidth={2.6} /> : <ArrowDown size={13} strokeWidth={2.6} />}
            {Math.abs(delta)}
          </span>
        ) : null,
      hint: `최근 24시간 ${summary?.last24h ?? 0}건`,
    },
    { icon: XOctagon, tile: "bg-toss-red", label: "오류", labelClass: "text-toss-red", value: summary?.error ?? 0, extra: `${pct(summary?.error ?? 0)}%`, hint: "즉시 확인이 필요한 이벤트" },
    { icon: AlertTriangle, tile: "bg-[#F59E0B]", label: "주의", labelClass: "text-[#D97706]", value: summary?.warning ?? 0, extra: `${pct(summary?.warning ?? 0)}%`, hint: "확인이 필요한 이벤트" },
    { icon: Info, tile: "bg-primary-600", label: "정보", labelClass: "text-primary-600", value: summary?.info ?? 0, extra: `${pct(summary?.info ?? 0)}%`, hint: "정상 동작 이벤트" },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
            <span className={cn("hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white sm:flex", c.tile)}>
              <Icon size={24} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className={cn("text-[14px] font-bold", c.labelClass)}>{c.label}</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <span className="text-[28px] font-extrabold leading-none tracking-tight tabular-nums text-ink-900">{c.value.toLocaleString()}</span>
                {typeof c.extra === "string" ? <span className="text-[13px] font-semibold tabular-nums text-ink-400">{c.extra}</span> : c.extra}
              </p>
              <p className="mt-1.5 text-[12.5px] text-ink-500 [word-break:keep-all]">{c.hint}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventDetail({ event, code, onClose }: { event: ActivityEvent | null; code?: string; onClose: () => void }) {
  const link = event ? eventLink(event) : null;
  const Icon = event ? TYPE_ICON[event.type] ?? Play : Play;
  return (
    <Modal
      open={!!event}
      onClose={onClose}
      title="이벤트 상세"
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
          {link && (
            <Link
              href={link}
              onClick={onClose}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary-600 px-5 text-[14px] font-bold text-white transition hover:bg-primary-700"
            >
              관련 화면으로
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
          )}
        </>
      }
    >
      {event && (
        <div>
          <div className="flex items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
              <Icon size={22} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[16px] font-extrabold text-ink-900">
                {event.title}
                <Badge tone={LEVEL_TONE[event.level]} solid>
                  {LEVEL_META[event.level].label}
                </Badge>
              </p>
              <p className="mt-1 text-[13px] text-ink-500">{TYPE_TEXT[event.type]}</p>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-line rounded-xl border border-line text-[13.5px]">
            {[
              ["발생 시각", formatDateTime(event.createdAt)],
              ["프로젝트", event.projectName ? `${event.projectName}${code ? ` (${code})` : ""}` : "-"],
              ["서버/대상", event.message || "-"],
              ["유형", event.type],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 px-4 py-3">
                <dt className="text-ink-400">{k}</dt>
                <dd className={cn("break-all font-semibold text-ink-900", k === "유형" && "font-mono text-[12.5px] font-medium text-ink-500")}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Modal>
  );
}
