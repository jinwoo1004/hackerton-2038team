"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";

export interface UsageSeries {
  key: string;
  label: string;
  color: string;
  points: { t: number; v: number }[];
}

const HEIGHT = 240;
const PAD = { top: 12, right: 14, bottom: 26, left: 42 };
const TICKS = [0, 25, 50, 75, 100];

function hhmm(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function UsageTrendChart({
  series,
  start,
  end,
  bucketSeconds,
  showTable,
}: {
  series: UsageSeries[];
  start: number;
  end: number;
  bucketSeconds: number;
  showTable: boolean;
}) {
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

  const times = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.t)))).sort((a, b) => a - b);

  if (showTable) {
    const rows = times.slice().reverse().slice(0, 30);
    return rows.length === 0 ? (
      <p className="py-20 text-center text-[12px] text-ink-400">이 기간에 받은 지표가 없습니다</p>
    ) : (
      <div className="max-h-[240px] overflow-auto">
        <table className="w-full text-[12px] tabular-nums">
          <thead className="sticky top-0 bg-white text-ink-400">
            <tr>
              <th className="py-1.5 text-left font-semibold">시각</th>
              {series.map((s) => (
                <th key={s.key} className="py-1.5 text-right font-semibold">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-ink-700">
            {rows.map((t) => (
              <tr key={t} className="border-t border-line">
                <td className="py-1.5">{hhmm(t)}</td>
                {series.map((s) => {
                  const p = s.points.find((x) => x.t === t);
                  return (
                    <td key={s.key} className="py-1.5 text-right">
                      {p ? `${p.v.toFixed(1)}%` : "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - start) / (end - start)) * plotW;
  const y = (v: number) => PAD.top + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;
  const labelCount = Math.max(2, Math.min(7, Math.floor(plotW / 90)));
  const labels = Array.from({ length: labelCount }, (_, i) => start + ((end - start) * i) / (labelCount - 1));

  // 수집이 끊긴 구간은 선을 잇지 않는다
  function segments(pts: { t: number; v: number }[]) {
    const out: { t: number; v: number }[][] = [];
    for (const p of pts) {
      const last = out[out.length - 1];
      if (last && p.t - last[last.length - 1].t <= bucketSeconds * 2500) last.push(p);
      else out.push([p]);
    }
    return out;
  }

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    if (!times.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = start + ((e.clientX - rect.left) / rect.width) * (end - start);
    let best = times[0];
    for (const c of times) if (Math.abs(c - t) < Math.abs(best - t)) best = c;
    setHover(best);
  }

  const rows =
    hover === null
      ? []
      : series
          .map((s) => ({ s, p: s.points.find((p) => p.t === hover) }))
          .filter((r): r is { s: UsageSeries; p: { t: number; v: number } } => !!r.p);
  const flip = hover !== null && x(hover) > width * 0.62;

  return (
    <div ref={ref} className="relative" style={{ height: HEIGHT }}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label="CPU, 메모리, 디스크 사용률 추이">
          {TICKS.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#EEF0F3" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-400 text-[10px] tabular-nums">
                {t}%
              </text>
            </g>
          ))}
          {labels.map((t, i) => (
            <text
              key={i}
              x={x(t)}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}
              className="fill-ink-400 text-[10px] tabular-nums"
            >
              {hhmm(t)}
            </text>
          ))}

          {series.map((s) =>
            segments(s.points).map((seg, i) =>
              seg.length > 1 ? (
                <path
                  key={`${s.key}-${i}`}
                  d={seg.map((p, j) => `${j ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : (
                <circle key={`${s.key}-${i}`} cx={x(seg[0].t)} cy={y(seg[0].v)} r={2.5} fill={s.color} />
              ),
            ),
          )}

          {hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="#94A3B8" strokeDasharray="3 3" />
              {rows.map((r) => (
                <circle key={r.s.key} cx={x(r.p.t)} cy={y(r.p.v)} r={4} fill={r.s.color} stroke="#fff" strokeWidth={2} />
              ))}
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

      {times.length === 0 && width > 0 && (
        <p className="absolute inset-0 flex items-center justify-center pb-6 text-[12px] text-ink-400">이 기간에 받은 지표가 없습니다</p>
      )}

      {hover !== null && rows.length > 0 && (
        <div
          className={cn(
            "pointer-events-none absolute top-2 z-10 min-w-[140px] rounded-lg bg-ink-900 px-3 py-2 text-[12px] text-white shadow-lift",
            flip ? "-translate-x-[calc(100%+10px)]" : "translate-x-[10px]",
          )}
          style={{ left: x(hover) }}
        >
          <p className="font-bold tabular-nums">{hhmm(hover)}</p>
          <ul className="mt-1 space-y-0.5">
            {rows.map((r) => (
              <li key={r.s.key} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.s.color }} />
                <span className="flex-1 text-ink-200">{r.s.label}</span>
                <span className="font-bold tabular-nums">{r.p.v.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Sparkline({ points, color, start, end }: { points: { t: number; v: number }[]; color: string; start: number; end: number }) {
  const w = 64;
  const h = 26;
  if (points.length < 2) return <span className="block h-[26px] w-16" />;
  const x = (t: number) => ((t - start) / (end - start)) * w;
  const y = (v: number) => h - 3 - (Math.max(0, Math.min(100, v)) / 100) * (h - 6);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const id = `spark-${color.replace("#", "")}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L${x(points[points.length - 1].t)},${h} L${x(points[0].t)},${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
