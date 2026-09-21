"use client";

import { useMemo, useState } from "react";
import { ChevronDown, FileCode2, Lightbulb } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { AnalysisFinding, FindingCategory, Severity } from "@/types";
import { CATEGORY_TEXT, SEVERITY } from "./severity";

const PAGE = 30;

export function FindingList({
  findings,
  category,
  onCategoryChange,
  truncated,
}: {
  findings: AnalysisFinding[];
  category: FindingCategory | "all";
  onCategoryChange: (c: FindingCategory | "all") => void;
  truncated?: boolean;
}) {
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<number | null>(null);

  const filtered = useMemo(
    () =>
      findings.filter(
        (f) => (category === "all" || f.category === category) && (severity === "all" || f.severity === severity),
      ),
    [findings, category, severity],
  );

  const categories = useMemo(() => {
    const present = new Set(findings.map((f) => f.category));
    return (Object.keys(CATEGORY_TEXT) as FindingCategory[]).filter((c) => present.has(c));
  }, [findings]);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          <FilterChip active={category === "all"} onClick={() => onCategoryChange("all")}>
            전체 {findings.length}
          </FilterChip>
          {categories.map((c) => (
            <FilterChip key={c} active={category === c} onClick={() => onCategoryChange(c)}>
              {CATEGORY_TEXT[c].label} {findings.filter((f) => f.category === c).length}
            </FilterChip>
          ))}
        </div>
        <div className="flex shrink-0 gap-1">
          {(["all", "CRITICAL", "WARNING", "INFO"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              className={cn(
                "h-8 rounded-lg px-2.5 text-[12px] font-semibold transition",
                severity === s ? "bg-ink-900 text-white" : "text-ink-500 hover:bg-ink-100",
              )}
            >
              {s === "all" ? "모든 등급" : SEVERITY[s].label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-5 py-12 text-center text-[13px] text-ink-400">조건에 맞는 항목이 없습니다.</p>
      ) : (
        <ul>
          {filtered.slice(0, limit).map((f, i) => {
            const s = SEVERITY[f.severity];
            const expanded = open === i;
            return (
              <li key={`${f.ruleId}-${f.file}-${f.line}-${i}`} className="border-b border-line last:border-0">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : i)}
                  aria-expanded={expanded}
                  className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-toss-soft"
                >
                  <span className={cn("mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold", s.soft, s.text)}>
                    <s.icon size={12} strokeWidth={2.4} />
                    {s.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-ink-900">{f.message}</span>
                    {f.file && (
                      <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[12px] text-ink-400">
                        <FileCode2 size={12} className="shrink-0" />
                        <span className="truncate font-mono">
                          {f.file}
                          {f.line ? `:${f.line}` : ""}
                        </span>
                      </span>
                    )}
                  </span>
                  <span className="hidden shrink-0 text-[12px] font-medium text-ink-400 sm:block">{CATEGORY_TEXT[f.category]?.label}</span>
                  <ChevronDown size={16} className={cn("mt-0.5 shrink-0 text-ink-300 transition-transform", expanded && "rotate-180")} />
                </button>
                {expanded && (
                  <div className="animate-fade-in space-y-2.5 px-5 pb-4 pl-[4.25rem]">
                    {f.snippet && (
                      <pre className="overflow-x-auto rounded-lg bg-ink-900 px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-100">
                        <code>{f.snippet}</code>
                      </pre>
                    )}
                    {f.recommendation && (
                      <p className="flex items-start gap-1.5 text-[13px] leading-relaxed text-ink-600">
                        <Lightbulb size={14} className="mt-0.5 shrink-0 text-primary-600" />
                        {f.recommendation}
                      </p>
                    )}
                    <p className="text-[11px] font-medium text-ink-300">규칙 {f.ruleId} · {f.title}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > limit && (
        <div className="border-t border-line px-5 py-3 text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="text-[13px] font-semibold text-primary-600 hover:underline"
          >
            {filtered.length - limit}개 더 보기
          </button>
        </div>
      )}
      {truncated && (
        <p className="border-t border-line px-5 py-3 text-[12px] text-ink-400">
          항목이 많아 상위 800개만 표시합니다. 개수 집계는 전체 기준입니다.
        </p>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3 text-[12px] font-semibold tabular-nums transition",
        active ? "border-primary-600 bg-primary-600 text-white" : "border-line bg-white text-ink-600 hover:bg-ink-100",
      )}
    >
      {children}
    </button>
  );
}
