"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pause, Play, Radio, Search } from "lucide-react";
import { telemetryApi, type LogQuery } from "@/services/agentApi";
import { cn } from "@/shared/lib/cn";
import { formatDateTime } from "@/shared/lib/format";
import { Card, CardHeader } from "@/shared/ui/Card";
import { Segmented } from "@/shared/ui/Switch";
import type { Agent, LogEntry } from "@/types";
import { LOG_LEVEL } from "./meta";

const POLL_MS = 4000;
const KEEP = 400;

const LEVELS = [
  { value: "ALL", label: "전체" },
  { value: "WARN", label: "경고 이상" },
  { value: "ERROR", label: "오류 이상" },
] as const;

function clock(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function LiveLogStream({ projectId, agents }: { projectId: number; agents: Agent[] }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState<NonNullable<LogQuery["level"]>>("ALL");
  const [agentId, setAgentId] = useState<number | undefined>();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const lastId = useRef<number | undefined>(undefined);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const reset = useCallback(() => {
    setLoading(true);
    telemetryApi
      .logs(projectId, { level, agentId, q: debounced, limit: 200 })
      .then((list) => {
        setEntries(list);
        lastId.current = list[0]?.id;
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [projectId, level, agentId, debounced]);

  useEffect(reset, [reset]);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      telemetryApi
        .logs(projectId, { level, agentId, q: debounced, afterId: lastId.current, limit: 200 })
        .then((list) => {
          if (!list.length) return;
          const first = lastId.current === undefined;
          lastId.current = list[0].id;
          setFresh(new Set(list.map((e) => e.id)));
          setEntries((prev) => (first ? list : [...list, ...prev].slice(0, KEEP)));
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [paused, projectId, level, agentId, debounced]);

  const multiAgent = agents.length > 1;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="실시간 수집 로그"
        description="에이전트가 보낸 로그를 4초마다 새로 가져옵니다."
        actions={
          agents.length > 0 && (
            <button
              type="button"
              onClick={() => setPaused((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[13px] font-semibold text-ink-700 transition hover:bg-ink-100"
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
              {paused ? "이어 받기" : "일시정지"}
            </button>
          )
        }
      />

      {agents.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <Radio size={24} strokeWidth={1.7} />
          </span>
          <p className="mt-4 text-[16px] font-bold text-ink-900">연결된 에이전트가 없습니다</p>
          <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-500">
            서버에 에이전트를 설치하면 로그 파일을 따로 올리지 않아도 새로 쌓이는 로그가 이곳에 바로 보입니다.
          </p>
          <Link
            href={`/projects/${projectId}/agents`}
            className="mt-5 inline-flex h-10 items-center rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            에이전트 연결하기
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 border-b border-line px-5 py-3 sm:flex-row sm:items-center">
            <Segmented options={LEVELS} value={level} onChange={setLevel} />
            {multiAgent && (
              <select
                value={agentId ?? ""}
                onChange={(e) => setAgentId(e.target.value ? Number(e.target.value) : undefined)}
                className="h-10 rounded-lg border border-line bg-white px-3 text-[13px] font-semibold text-ink-700 outline-none focus:border-primary-400"
                aria-label="에이전트"
              >
                <option value="">모든 서버</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
            <label className="relative flex-1 sm:max-w-xs sm:ml-auto">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="메시지 검색"
                className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-[13px] outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </label>
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {loading ? (
              <p className="px-5 py-12 text-center text-[13px] text-ink-400">로그를 불러오는 중입니다.</p>
            ) : entries.length === 0 ? (
              <p className="px-5 py-12 text-center text-[13px] leading-relaxed text-ink-400">
                {debounced || level !== "ALL"
                  ? "조건에 맞는 로그가 없습니다."
                  : "아직 받은 로그가 없습니다. 에이전트에서 수집할 로그 폴더를 확인해주세요."}
              </p>
            ) : (
              <ul className="font-mono text-[12px]">
                {entries.map((e) => {
                  const lv = LOG_LEVEL[e.level];
                  const expanded = open === e.id;
                  return (
                    <li
                      key={e.id}
                      className={cn(
                        "border-b border-line/70 last:border-0",
                        fresh.has(e.id) && "animate-fade-in bg-primary-50/40",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : e.id)}
                        aria-expanded={expanded}
                        className="flex w-full items-start gap-3 px-5 py-2 text-left transition hover:bg-toss-soft"
                      >
                        <time dateTime={e.loggedAt} title={formatDateTime(e.loggedAt)} className="shrink-0 tabular-nums text-ink-400">
                          {clock(e.loggedAt)}
                        </time>
                        <span className={cn("w-[52px] shrink-0 rounded px-1 text-center text-[10px] font-bold leading-[18px]", lv.tone)}>
                          {lv.label}
                        </span>
                        {multiAgent && <span className="hidden shrink-0 text-ink-400 sm:inline">{e.agentName}</span>}
                        <span className={cn("min-w-0 flex-1 text-ink-800", expanded ? "whitespace-pre-wrap break-all" : "truncate")}>
                          {e.message}
                        </span>
                      </button>
                      {expanded && e.source && (
                        <p className="px-5 pb-2 pl-[148px] text-[11px] text-ink-400">{e.source}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
