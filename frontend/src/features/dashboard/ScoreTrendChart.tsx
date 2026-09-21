"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";

export interface ScorePoint {
  day: number;
  score: number | null;
  projects: number;
}

const HEIGHT = 200;
const PAD = { top: 28, right: 22, bottom: 26, left: 42 };
const TICKS = [0, 20, 40, 60, 80, 100];
const COLOR = "#2563EB";

function mmdd(ms: number) {
  const d = new Date(ms);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function ScoreTrendChart({ points, showTable }: { points: ScorePoint[]; showTable: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [showTable]);

  if (showTable) {
    return (
      <div className="max-h-[200px] overflow-auto">
        <table className="w-full text-[12px] tabular-nums">
          <thead className="sticky top-0 bg-white text-ink-400">
            <tr>
              <th className="py-1.5 text-left font-semibold">날짜</th>
              <th className="py-1.5 text-right font-semibold">평균 점수</th>
              <th className="py-1.5 text-right font-semibold">반영 프로젝트</th>
            </tr>
          </thead>
          <tbody className="text-ink-700">
            {points
              .slice()
              .reverse()
              .map((p) => (
                <tr key={p.day} className="border-t border-line">
                  <td className="py-1.5">{mmdd(p.day)}</td>
                  <td className="py-1.5 text-right font-semibold text-ink-900">{p.score ?? "-"}</td>
                  <td className="py-1.5 text-right">{p.projects ? `${p.projects}개` : "-"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  }

  const n = points.length;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const y = (v: number) => PAD.top + plotH - (v / 100) * plotH;

  const segments: { i: number; v: number }[][] = [];
  points.forEach((p, i) => {
    if (p.score == null) return;
    const last = segments[segments.length - 1];
    if (last && last[last.length - 1].i === i - 1) last.push({ i, v: p.score });
    else segments.push([{ i, v: p.score }]);
  });
  const lastSeg = segments[segments.length - 1];
  const lastPoint = lastSeg ? lastSeg[lastSeg.length - 1] : null;
  const hasData = segments.length > 0;
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 52))));

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1)))));
  }

  const hovered = hover !== null ? points[hover] : null;
  const flip = hover !== null && x(hover) > width * 0.62;

  return (
    <div ref={ref} className="relative" style={{ height: HEIGHT }}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label="평균 품질 점수 추이">
          <defs>
            <linearGradient id="score-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={COLOR} stopOpacity={0.16} />
              <stop offset="100%" stopColor={COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>

          {TICKS.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#EEF0F3" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-400 text-[10px] tabular-nums">
                {t}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            (n - 1 - i) % labelEvery === 0 ? (
              <text
                key={p.day}
                x={x(i)}
                y={HEIGHT - 6}
                textAnchor="middle"
                className="fill-ink-400 text-[10px] tabular-nums"
              >
                {mmdd(p.day)}
              </text>
            ) : null,
          )}

          {segments.map((seg, k) =>
            seg.length > 1 ? (
              <g key={k}>
                <path
                  d={`M${x(seg[0].i)},${y(0)} ${seg.map((p) => `L${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")} L${x(seg[seg.length - 1].i)},${y(0)} Z`}
                  fill="url(#score-area)"
                />
                <path
                  d={seg.map((p, j) => `${j ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke={COLOR}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            ) : null,
          )}
          {segments.flat().map((p) => (
            <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={3} fill="#fff" stroke={COLOR} strokeWidth={2} />
          ))}

          {lastPoint && hover === null && (
            <g>
              <circle cx={x(lastPoint.i)} cy={y(lastPoint.v)} r={5.5} fill={COLOR} stroke="#fff" strokeWidth={2.5} />
            </g>
          )}

          {hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="#94A3B8" strokeDasharray="3 3" />
              {hovered?.score != null && (
                <circle cx={x(hover)} cy={y(hovered.score)} r={5} fill={COLOR} stroke="#fff" strokeWidth={2.5} />
              )}
            </>
          )}

          <rect
            x={PAD.left}
            y={0}
            width={plotW}
            height={HEIGHT - PAD.bottom}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
      )}

      {lastPoint && hover === null && width > 0 && (
        <span
          className="pointer-events-none absolute -translate-x-1/2 rounded-md bg-primary-50 px-2 py-0.5 text-[12px] font-extrabold tabular-nums text-primary-700"
          style={{ left: Math.min(Math.max(x(lastPoint.i), 24), width - 24), top: y(lastPoint.v) - 30 }}
        >
          {lastPoint.v}
        </span>
      )}

      {!hasData && width > 0 && (
        <p className="absolute inset-0 flex items-center justify-center pb-6 text-[12px] text-ink-400">
          이 기간에 완료된 분석이 없습니다
        </p>
      )}

      {hovered && hover !== null && (
        <div
          className={cn(
            "pointer-events-none absolute top-2 z-10 min-w-[128px] rounded-lg bg-ink-900 px-3 py-2 text-[12px] text-white shadow-lift",
            flip ? "-translate-x-[calc(100%+10px)]" : "translate-x-[10px]",
          )}
          style={{ left: x(hover) }}
        >
          <p className="font-bold tabular-nums">{mmdd(hovered.day)}</p>
          {hovered.score != null ? (
            <>
              <p className="mt-1 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: COLOR }} />
                <span className="flex-1 text-ink-200">평균 점수</span>
                <span className="font-bold tabular-nums">{hovered.score}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-ink-300">프로젝트 {hovered.projects}개 기준</p>
            </>
          ) : (
            <p className="mt-1 text-ink-300">분석 결과 없음</p>
          )}
        </div>
      )}
    </div>
  );
}
