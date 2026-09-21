"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Code2,
  FileText,
  FileSearch,
  Loader2,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { analysisApi } from "@/services/analysisApi";
import { CATEGORY_ORDER, CATEGORY_TEXT, SERIES_COLORS, SEVERITY } from "@/features/analysis/severity";
import { cn } from "@/shared/lib/cn";
import type { Analysis, AnalysisListItem, AnalysisResult } from "@/types";

type Tab = "summary" | "code" | "logs" | "security" | "detail";

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: "summary", label: "분석 요약", icon: FileSearch },
  { key: "code", label: "코드 분석", icon: Code2 },
  { key: "logs", label: "로그 분석", icon: ScrollText },
  { key: "security", label: "보안 분석", icon: ShieldCheck },
  { key: "detail", label: "상세 결과", icon: FileText },
];

export function AnalysisDetailPanel({ item }: { item: AnalysisListItem }) {
  const [tab, setTab] = useState<Tab>("summary");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAnalysis(null);
    setFailed(false);
    analysisApi
      .get(item.projectId, item.id)
      .then((a) => !cancelled && setAnalysis(a))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [item.projectId, item.id]);

  const result = analysis?.result ?? null;

  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex gap-1 overflow-x-auto border-b border-line px-3" role="tablist">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                "relative flex h-12 shrink-0 items-center gap-1.5 px-3 text-[13px] font-semibold transition",
                active ? "text-primary-600" : "text-ink-500 hover:text-ink-900",
              )}
            >
              <Icon size={15} />
              {t.label}
              {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary-600" />}
            </button>
          );
        })}
      </div>

      <div className="p-5">
        {!analysis && !failed && (
          <p className="flex items-center justify-center gap-2 py-14 text-[13px] text-ink-400">
            <Loader2 size={16} className="animate-spin" />
            결과를 불러오는 중입니다
          </p>
        )}
        {failed && <p className="py-14 text-center text-[13px] text-ink-400">분석 결과를 불러오지 못했습니다.</p>}
        {analysis && tab === "summary" && <Summary item={item} result={result} />}
        {analysis && tab === "code" && <CodeTab result={result} />}
        {analysis && tab === "logs" && <LogsTab result={result} />}
        {analysis && tab === "security" && <SecurityTab result={result} />}
        {analysis && tab === "detail" && <DetailTab item={item} result={result} />}
      </div>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-[15px] font-bold text-ink-900">{title}</h3>
      {description && <p className="mt-0.5 text-[12.5px] text-ink-400">{description}</p>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-line py-12 text-center text-[13px] text-ink-400">{text}</p>;
}

function verdict(item: AnalysisListItem, result: AnalysisResult | null) {
  if (item.status === "FAILED") return { icon: XCircle, tile: "bg-toss-red", title: "분석에 실패했습니다.", text: item.summary || "분석 서비스 연결 상태를 확인해주세요." };
  if (item.status === "QUEUED" || item.status === "ANALYZING") return { icon: Loader2, tile: "bg-primary-600", title: "분석이 진행 중입니다.", text: "완료되면 결과가 이곳에 표시됩니다." };
  const critical = result?.overview.critical ?? item.critical ?? 0;
  const warning = result?.overview.warning ?? item.warning ?? 0;
  if (critical > 0) return { icon: AlertOctagon, tile: "bg-toss-red", title: `심각 항목 ${critical}건이 발견되었습니다.`, text: "보안 분석과 상세 결과에서 먼저 확인해주세요." };
  if (warning > 0) return { icon: ShieldAlert, tile: "bg-[#F59E0B]", title: `주의 항목 ${warning}건이 있습니다.`, text: "당장 문제는 아니지만 정리하면 품질 점수가 올라갑니다." };
  return { icon: CheckCircle2, tile: "bg-toss-green", title: "분석이 완료되었습니다.", text: "프로젝트의 코드와 구성을 분석한 결과, 특별한 이슈가 발견되지 않았습니다." };
}

function Summary({ item, result }: { item: AnalysisListItem; result: AnalysisResult | null }) {
  const v = verdict(item, result);
  const Icon = v.icon;
  const issues = result ? result.overview.critical + result.overview.warning + result.overview.info : null;
  const tiles = [
    { icon: FileText, label: "분석된 파일", value: result?.source.available ? `${(result.source.analyzedFiles ?? 0).toLocaleString()}개` : "-" },
    { icon: Code2, label: "코드 라인 수", value: result?.source.available && result.source.codeLines != null ? result.source.codeLines.toLocaleString() : "-" },
    { icon: ShieldCheck, label: "발견된 이슈", value: issues == null ? "-" : `${issues.toLocaleString()}개` },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:divide-x lg:divide-line">
      <div className="min-w-0">
        <SectionTitle title="분석 요약" description="프로젝트의 전반적인 분석 결과입니다." />
        <div className="flex items-center gap-3.5 rounded-xl border border-line p-4">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white", v.tile)}>
            <Icon size={20} strokeWidth={2.4} className={cn(Icon === Loader2 && "animate-spin")} />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-ink-900">{v.title}</p>
            <p className="mt-0.5 text-[12.5px] text-ink-500 [word-break:keep-all]">{v.text}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {tiles.map((t) => {
            const TIcon = t.icon;
            return (
              <div key={t.label} className="flex items-center gap-3 rounded-xl border border-line p-4">
                <TIcon size={20} className="shrink-0 text-ink-500" />
                <div className="min-w-0">
                  <p className="text-[12px] text-ink-400">{t.label}</p>
                  <p className="mt-0.5 text-[18px] font-extrabold tabular-nums text-ink-900">{t.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 lg:pl-6">
        <SectionTitle title="품질 점수" description="발견된 항목의 심각도를 반영해 매긴 점수입니다." />
        <div className="flex flex-wrap items-center gap-6">
          <ScoreRing score={result?.overview.score ?? item.score ?? null} grade={result?.overview.grade ?? item.grade ?? null} />
          <ul className="min-w-[160px] flex-1 space-y-2 text-[13px]">
            {(result?.categories.length ? orderedCategories(result) : []).slice(0, 5).map((c, i) => (
              <li key={c.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold text-ink-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                  {CATEGORY_TEXT[c.key]?.label ?? c.label}
                </span>
                <span className={cn("font-bold tabular-nums", c.critical ? "text-toss-red" : "text-ink-900")}>{c.count}건</span>
              </li>
            ))}
            {!result?.categories.length && <li className="text-ink-400">분류별 결과가 없습니다.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function orderedCategories(result: AnalysisResult) {
  return CATEGORY_ORDER.map((k) => result.categories.find((c) => c.key === k)).filter((c): c is NonNullable<typeof c> => !!c);
}

function ScoreRing({ score, grade }: { score: number | null; grade: string | null }) {
  const size = 132;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const len = score == null ? 0 : (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`품질 점수 ${score ?? "-"}점`}>
        <defs>
          <linearGradient id="score-ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#score-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${len} ${c - len}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[30px] font-extrabold leading-none tracking-tight tabular-nums text-ink-900">{score ?? "-"}</span>
        {grade && <span className="mt-1 text-[15px] font-extrabold text-primary-600">{grade}</span>}
      </div>
    </div>
  );
}

function CodeTab({ result }: { result: AnalysisResult | null }) {
  const s = result?.source;
  if (!s?.available) return <Empty text="소스 파일이 없어 코드 분석을 하지 않았습니다." />;
  const stats = [
    ["분석 파일", s.analyzedFiles],
    ["전체 줄", s.totalLines],
    ["코드 줄", s.codeLines],
    ["주석 줄", s.commentLines],
    ["함수", s.functions],
  ] as const;
  const langs = (s.languages ?? []).slice(0, SERIES_COLORS.length);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line p-4">
            <p className="text-[12px] text-ink-400">{label}</p>
            <p className="mt-0.5 text-[18px] font-extrabold tabular-nums text-ink-900">{(value ?? 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {langs.length > 0 && (
        <div>
          <SectionTitle title="언어 비율" />
          <div className="flex h-3 overflow-hidden rounded-full bg-ink-100">
            {langs.map((l, i) => (
              <span key={l.name} className="h-full border-r-2 border-white last:border-r-0" style={{ width: `${l.ratio}%`, background: SERIES_COLORS[i] }} title={`${l.name} ${l.ratio}%`} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-600">
            {langs.map((l, i) => (
              <li key={l.name} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                <span className="font-semibold text-ink-900">{l.name}</span>
                <span className="tabular-nums text-ink-400">{l.ratio}% · {l.files}개 파일</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <RankList
          title="큰 파일"
          rows={(s.largestFiles ?? []).slice(0, 5).map((f) => ({ key: f.path, left: f.path, right: `${f.lines.toLocaleString()}줄` }))}
          empty="큰 파일이 없습니다."
        />
        <RankList
          title="긴 함수"
          rows={(s.longFunctions ?? []).slice(0, 5).map((f) => ({ key: `${f.file}:${f.line}`, left: `${f.name}  ${f.file}:${f.line}`, right: `${f.lines}줄` }))}
          empty="기준을 넘는 긴 함수가 없습니다."
        />
      </div>
    </div>
  );
}

function RankList({ title, rows, empty }: { title: string; rows: { key: string; left: string; right: string }[]; empty: string }) {
  return (
    <div className="min-w-0">
      <SectionTitle title={title} />
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12.5px]">
              <span className="min-w-0 truncate font-mono text-ink-700" title={r.left}>
                {r.left}
              </span>
              <span className="shrink-0 font-bold tabular-nums text-ink-900">{r.right}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const LEVEL_ORDER = ["FATAL", "ERROR", "WARN", "INFO", "DEBUG"] as const;
const LEVEL_COLOR: Record<(typeof LEVEL_ORDER)[number], string> = {
  FATAL: "text-toss-red",
  ERROR: "text-toss-red",
  WARN: "text-toss-amber",
  INFO: "text-ink-700",
  DEBUG: "text-ink-400",
};

function LogsTab({ result }: { result: AnalysisResult | null }) {
  const l = result?.logs;
  if (!l?.available) return <Empty text="로그 파일이 없어 로그 분석을 하지 않았습니다." />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {LEVEL_ORDER.map((level) => (
          <div key={level} className="rounded-xl border border-line p-4">
            <p className="text-[12px] font-semibold text-ink-400">{level}</p>
            <p className={cn("mt-0.5 text-[18px] font-extrabold tabular-nums", LEVEL_COLOR[level])}>{(l.levels?.[level] ?? 0).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <RankList
        title="자주 나온 오류"
        rows={(l.topErrors ?? []).slice(0, 6).map((e, i) => ({ key: `${i}`, left: `[${e.level}] ${e.message}`, right: `${e.count.toLocaleString()}회` }))}
        empty="반복된 오류가 없습니다."
      />
    </div>
  );
}

function SecurityTab({ result }: { result: AnalysisResult | null }) {
  const findings = (result?.findings ?? []).filter((f) => f.category === "security");
  if (!result) return <Empty text="분석 결과가 없습니다." />;
  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-toss-green text-white">
          <ShieldCheck size={22} strokeWidth={2.2} />
        </span>
        <p className="mt-3 text-[14px] font-bold text-ink-900">발견된 보안 이슈가 없습니다</p>
        <p className="mt-1 text-[12.5px] text-ink-400">{CATEGORY_TEXT.security.description} 등을 확인했어요.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-line rounded-xl border border-line">
      {findings.slice(0, 8).map((f, i) => {
        const sev = SEVERITY[f.severity];
        const SevIcon = sev.icon;
        return (
          <li key={`${f.ruleId}-${i}`} className="flex items-start gap-3 px-4 py-3">
            <SevIcon size={17} className={cn("mt-0.5 shrink-0", sev.text)} />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold text-ink-900">
                {f.title}
                <span className={cn("ml-2 text-[11.5px] font-bold", sev.text)}>{sev.label}</span>
              </p>
              <p className="mt-0.5 truncate text-[12.5px] text-ink-500">{f.message}</p>
              {f.file && (
                <p className="mt-0.5 truncate font-mono text-[11.5px] text-ink-400">
                  {f.file}
                  {f.line ? `:${f.line}` : ""}
                </p>
              )}
            </div>
          </li>
        );
      })}
      {findings.length > 8 && <li className="px-4 py-2.5 text-center text-[12.5px] text-ink-400">외 {findings.length - 8}건은 상세 결과에서 볼 수 있어요.</li>}
    </ul>
  );
}

function DetailTab({ item, result }: { item: AnalysisListItem; result: AnalysisResult | null }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <p className="text-[13.5px] text-ink-600 [word-break:keep-all]">
        {result
          ? `발견 항목 ${result.findings.length.toLocaleString()}건과 규칙 문서, 메모를 모두 볼 수 있는 상세 결과 화면으로 이동합니다.`
          : "상세 결과 화면에서 이 프로젝트의 분석 이력을 확인할 수 있습니다."}
      </p>
      <Link
        href={`/projects/${item.projectId}/analysis`}
        className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary-600 px-5 text-[14px] font-bold text-white transition hover:bg-primary-700"
      >
        상세 결과 열기
        <ArrowRight size={16} strokeWidth={2.4} />
      </Link>
    </div>
  );
}
