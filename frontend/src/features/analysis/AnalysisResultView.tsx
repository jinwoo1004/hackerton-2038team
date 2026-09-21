"use client";

import { useState } from "react";
import Link from "next/link";
import { BookCheck, CircleAlert, FileCode2, ScrollText, Sparkles } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Card, CardBody, CardHeader } from "@/shared/ui/Card";
import type { AnalysisResult, CategorySummary, FindingCategory, SourceStats } from "@/types";
import { FindingList } from "./FindingList";
import { CATEGORY_ORDER, CATEGORY_TEXT, OTHER_COLOR, SERIES_COLORS, SEVERITY } from "./severity";

const GRADE_TONE: Record<string, string> = {
  A: "text-toss-green",
  B: "text-primary-600",
  C: "text-toss-amber",
  D: "text-toss-amber",
  E: "text-toss-red",
};

export function AnalysisResultView({
  result,
  summary,
  projectId,
}: {
  result: AnalysisResult;
  summary?: string | null;
  projectId: number;
}) {
  const [category, setCategory] = useState<FindingCategory | "all">("all");
  const byKey = new Map(result.categories.map((c) => [c.key, c]));

  function pick(c: FindingCategory) {
    setCategory(c);
    document.getElementById("findings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-6">
      {result.notes.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-toss-amber/30 bg-toss-amber-soft px-4 py-3.5">
          <CircleAlert size={16} className="mt-0.5 shrink-0 text-toss-amber" />
          <ul className="space-y-0.5 text-[13px] leading-relaxed text-ink-700">
            {result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <ScoreCard result={result} />
        <Card className="p-5">
          <p className="text-[13px] font-bold text-ink-900">등급별 발견 항목</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {(["CRITICAL", "WARNING", "INFO"] as const).map((s) => {
              const meta = SEVERITY[s];
              const value = result.overview[s.toLowerCase() as "critical" | "warning" | "info"];
              return (
                <div key={s} className="rounded-xl bg-toss-soft px-4 py-3.5">
                  <span className={cn("inline-flex items-center gap-1 text-[12px] font-bold", meta.text)}>
                    <meta.icon size={13} strokeWidth={2.4} />
                    {meta.label}
                  </span>
                  <p className="mt-1.5 text-[26px] font-extrabold leading-none tracking-tight text-ink-900 tabular-nums">
                    {value.toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
          {summary && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3">
              <Sparkles size={15} className="mt-0.5 shrink-0 text-primary-600" />
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-700">{summary}</p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CATEGORY_ORDER.map((key) => (
          <CategoryCard key={key} category={byKey.get(key)} categoryKey={key} onPick={pick} />
        ))}
      </div>

      {result.source.available && <SourceOverview source={result.source} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <RuleCard result={result} />
        <LogCard result={result} projectId={projectId} />
      </div>

      <Card id="findings" className="scroll-mt-20 overflow-hidden">
        <CardHeader title="발견 항목" description="항목을 누르면 코드와 조치 방법을 볼 수 있습니다." />
        <FindingList
          findings={result.findings}
          category={category}
          onCategoryChange={setCategory}
          truncated={result.truncated}
        />
      </Card>
    </div>
  );
}

function ScoreCard({ result }: { result: AnalysisResult }) {
  const { score, grade } = result.overview;
  return (
    <Card className="flex flex-col justify-between p-5">
      <p className="text-[13px] font-bold text-ink-900">품질 점수</p>
      <div className="mt-3 flex items-end gap-3">
        <span className="text-[56px] font-extrabold leading-none tracking-[-0.04em] text-ink-900 tabular-nums">{score}</span>
        <span className="mb-1.5 text-[15px] font-semibold text-ink-400">/ 100</span>
        <span className={cn("mb-1 ml-auto text-[32px] font-extrabold leading-none", GRADE_TONE[grade] ?? "text-ink-500")}>
          {grade}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-100" aria-hidden>
        <div className="h-full rounded-full bg-primary-600 transition-[width] duration-700" style={{ width: `${score}%` }} />
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-ink-400">
        코드 1,000줄당 발견 항목의 가중치(심각 12, 주의 3, 참고 0.5)로 계산합니다.
      </p>
    </Card>
  );
}

function CategoryCard({
  category,
  categoryKey,
  onPick,
}: {
  category?: CategorySummary;
  categoryKey: FindingCategory;
  onPick: (c: FindingCategory) => void;
}) {
  const text = CATEGORY_TEXT[categoryKey];
  const count = category?.count ?? 0;
  const worst = category?.critical ? "CRITICAL" : category?.warning ? "WARNING" : count ? "INFO" : null;
  return (
    <button
      type="button"
      disabled={!count}
      onClick={() => onPick(categoryKey)}
      className="group rounded-2xl border border-line bg-white p-5 text-left shadow-soft transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-card disabled:cursor-default"
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-ink-900">{text.label}</span>
        {worst ? (
          <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold", SEVERITY[worst].soft, SEVERITY[worst].text)}>
            {SEVERITY[worst].label}
          </span>
        ) : (
          <span className="rounded-md bg-toss-green-soft px-1.5 py-0.5 text-[11px] font-bold text-toss-green">양호</span>
        )}
      </div>
      <p className="mt-3 text-[28px] font-extrabold leading-none tracking-tight text-ink-900 tabular-nums">
        {count.toLocaleString()}
        <span className="ml-1 text-[14px] font-semibold text-ink-400">건</span>
      </p>
      <p className="mt-2 text-[12px] text-ink-400">{text.description}</p>
      {count > 0 && category && (
        <p className="mt-3 flex gap-3 text-[12px] font-medium text-ink-500 tabular-nums">
          <span>심각 {category.critical}</span>
          <span>주의 {category.warning}</span>
          <span>참고 {category.info}</span>
        </p>
      )}
    </button>
  );
}

function SourceOverview({ source }: { source: SourceStats }) {
  const langs = source.languages ?? [];
  const top = langs.slice(0, SERIES_COLORS.length);
  const rest = langs.slice(SERIES_COLORS.length);
  const segments = [
    ...top.map((l, i) => ({ name: l.name, ratio: l.ratio, lines: l.lines, files: l.files, color: SERIES_COLORS[i] })),
    ...(rest.length
      ? [{
          name: "기타",
          ratio: Math.round(rest.reduce((s, l) => s + l.ratio, 0) * 10) / 10,
          lines: rest.reduce((s, l) => s + l.lines, 0),
          files: rest.reduce((s, l) => s + l.files, 0),
          color: OTHER_COLOR,
        }]
      : []),
  ];
  const [hover, setHover] = useState<number | null>(null);
  const commentRatio = source.codeLines ? Math.round(((source.commentLines ?? 0) / (source.codeLines + (source.commentLines ?? 0))) * 100) : 0;

  const stats = [
    { label: "분석 파일", value: (source.analyzedFiles ?? 0).toLocaleString() },
    { label: "코드 줄", value: (source.codeLines ?? 0).toLocaleString() },
    { label: "주석 비율", value: `${commentRatio}%` },
    { label: "함수", value: (source.functions ?? 0).toLocaleString() },
  ];

  return (
    <Card>
      <CardHeader title="소스 개요" description="ZIP 에서 인식한 언어와 규모입니다." />
      <CardBody className="space-y-6">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-[12px] font-semibold text-ink-400">{s.label}</dt>
              <dd className="mt-1 text-[22px] font-extrabold tracking-tight text-ink-900 tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>

        {segments.length > 0 && (
          <div>
            <p className="mb-2.5 text-[13px] font-bold text-ink-900">언어 비중 (줄 수 기준)</p>
            <div className="relative">
              <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label="언어별 줄 수 비중">
                {segments.map((s, i) => (
                  <div
                    key={s.name}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    className="h-full min-w-[3px] transition-opacity"
                    style={{ width: `${s.ratio}%`, background: s.color, opacity: hover === null || hover === i ? 1 : 0.35 }}
                  />
                ))}
              </div>
              {hover !== null && (
                <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-ink-900 px-3 py-2 text-[12px] text-white shadow-lift">
                  <span className="font-bold">{segments[hover].name}</span> {segments[hover].ratio}%
                  <span className="ml-2 text-ink-300">
                    {segments[hover].files}개 파일, {segments[hover].lines.toLocaleString()}줄
                  </span>
                </div>
              )}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {segments.map((s, i) => (
                <li
                  key={s.name}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  className="flex items-center gap-1.5 text-[12px] text-ink-600"
                >
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                  <span className="font-semibold text-ink-900">{s.name}</span>
                  <span className="tabular-nums text-ink-400">{s.ratio}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <MiniList
            title="가장 긴 파일"
            empty="파일 정보가 없습니다."
            items={(source.largestFiles ?? []).map((f) => ({ key: f.path, left: f.path, right: `${f.lines.toLocaleString()}줄` }))}
          />
          <MiniList
            title="기준을 넘는 함수"
            empty="기준을 넘는 함수가 없습니다."
            items={(source.longFunctions ?? []).map((f) => ({
              key: `${f.file}:${f.line}`,
              left: `${f.name}  ${f.file}:${f.line}`,
              right: `${f.lines}줄`,
            }))}
          />
        </div>
      </CardBody>
    </Card>
  );
}

function MiniList({ title, items, empty }: { title: string; items: { key: string; left: string; right: string }[]; empty: string }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-ink-900">
        <FileCode2 size={14} className="text-ink-400" />
        {title}
      </p>
      {items.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {items.slice(0, 5).map((it) => (
            <li key={it.key} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <span className="min-w-0 truncate font-mono text-[12px] text-ink-700">{it.left}</span>
              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-500">{it.right}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-3.5 py-3 text-[12px] text-ink-400">{empty}</p>
      )}
    </div>
  );
}

function RuleCard({ result }: { result: AnalysisResult }) {
  const { rules } = result;
  const limits = rules.limits;
  return (
    <Card>
      <CardHeader title="프로젝트 규칙 반영" description="규칙 문서에서 읽어 분석에 적용한 기준입니다." />
      <CardBody className="space-y-4">
        {rules.extractionSource && <p className="text-[12px] font-semibold text-primary-600">{rules.extractionSource === "OPENAI" ? "OpenAI 규칙 추출 + 정적 검사" : "로컬 규칙 추출 + 정적 검사"}</p>}
        {rules.documents.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-ink-400">
            등록된 규칙 문서가 없어 기본 기준으로 분석했습니다. 프로젝트 파일 탭에서 규칙 문서를 등록하면
            금지 항목과 길이 기준을 자동으로 읽습니다.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rules.documents.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="flex min-w-0 items-center gap-1.5">
                  <BookCheck size={14} className={d.parsed ? "shrink-0 text-toss-green" : "shrink-0 text-ink-300"} />
                  <span className="truncate font-medium text-ink-800">{d.name}</span>
                </span>
                <span className="shrink-0 text-[12px] text-ink-400">{d.parsed ? `규칙 ${d.ruleCount}개` : d.note}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className="grid grid-cols-3 gap-2">
          {[
            { label: "파일 길이", value: `${limits.fileLines.toLocaleString()}줄` },
            { label: "함수 길이", value: `${limits.functionLines}줄` },
            { label: "한 줄 길이", value: `${limits.lineLength}자` },
          ].map((l) => (
            <div key={l.label} className="rounded-xl bg-toss-soft px-3 py-2.5">
              <dt className="text-[11px] font-semibold text-ink-400">{l.label}</dt>
              <dd className="mt-0.5 text-[15px] font-bold text-ink-900 tabular-nums">{l.value}</dd>
            </div>
          ))}
        </dl>
        {rules.forbidden.length > 0 && (
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-ink-400">금지 항목</p>
            <div className="flex flex-wrap gap-1.5">
              {rules.forbidden.map((f) => (
                <code key={f} className="rounded-md bg-ink-100 px-2 py-0.5 text-[12px] text-ink-700">
                  {f}
                </code>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function LogCard({ result, projectId }: { result: AnalysisResult; projectId: number }) {
  const logs = result.logs;
  if (!logs.available || !logs.levels) {
    return (
      <Card>
        <CardHeader title="로그 분석" description="운영 로그의 오류 패턴을 모아 보여줍니다." />
        <CardBody>
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line px-4 py-5">
            <ScrollText size={20} className="text-ink-300" />
            <p className="text-[13px] leading-relaxed text-ink-500">
              등록된 로그 파일이 없습니다. 로그 탭에서 애플리케이션 로그를 올리면 다음 분석부터 오류 패턴이 함께 집계됩니다.
            </p>
            <Link href={`/projects/${projectId}/logs`} className="text-[13px] font-semibold text-primary-600 hover:underline">
              로그 등록하러 가기
            </Link>
          </div>
        </CardBody>
      </Card>
    );
  }
  const lv = logs.levels;
  return (
    <Card>
      <CardHeader title="로그 분석" description={`${logs.files}개 파일, ${(logs.lines ?? 0).toLocaleString()}줄`} />
      <CardBody className="space-y-4">
        <dl className="grid grid-cols-3 gap-2">
          {[
            { label: "오류", value: lv.ERROR + lv.FATAL, tone: "text-toss-red" },
            { label: "경고", value: lv.WARN, tone: "text-toss-amber" },
            { label: "정보", value: lv.INFO, tone: "text-ink-500" },
          ].map((l) => (
            <div key={l.label} className="rounded-xl bg-toss-soft px-3 py-2.5">
              <dt className={cn("text-[11px] font-bold", l.tone)}>{l.label}</dt>
              <dd className="mt-0.5 text-[17px] font-extrabold text-ink-900 tabular-nums">{l.value.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
        {(logs.topErrors ?? []).length > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {logs.topErrors!.slice(0, 4).map((e) => (
              <li key={e.message} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <span className="min-w-0 truncate font-mono text-[12px] text-ink-700">{e.message}</span>
                <span className="shrink-0 text-[12px] font-bold tabular-nums text-toss-red">{e.count.toLocaleString()}회</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
