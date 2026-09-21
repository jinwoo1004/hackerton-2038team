"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SERIES_COLORS } from "@/features/analysis/severity";
import { cn } from "@/shared/lib/cn";
import type { MetricBucket, MetricSeries } from "@/types";

type MetricKey = "cpuPct" | "memoryPct" | "diskPct";

const HEIGHT = 168;
const PAD = { top: 10, right: 10, bottom: 24, left: 34 };
const TICKS = [0, 50, 100];

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function colorOf(agentId: number, order: number[]): string {
  const i = order.indexOf(agentId);
  return i >= 0 && i < SERIES_COLORS.length ? SERIES_COLORS[i] : "#b4b2a9";
}

export function MetricChart({
  title,
  metric,
  series,
  order,
  minutes,
  bucketSeconds,
  now,
}: {
  title: string;
  metric: MetricKey;
  series: MetricSeries[];
  order: number[];
  minutes: number;
  bucketSeconds: number;
  now: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const start = now - minutes * 60_000;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (ms: number) => PAD.left + ((ms - start) / (now - start)) * plotW;
  const y = (v: number) => PAD.top + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;

  const lines = useMemo(
    () =>
      series.map((s) => {
        const pts = s.points
          .map((p) => ({ t: Date.parse(p.time), v: p[metric] }))
          .filter((p): p is { t: number; v: number } => p.v != null && p.t >= start - bucketSeconds * 1000);
        return { series: s, pts };
      }),
    [series, metric, start, bucketSeconds],
  );

  const times = useMemo(() => {
    const set = new Set<number>();
    lines.forEach((l) => l.pts.forEach((p) => set.add(p.t)));
    return Array.from(set).sort((a, b) => a - b);
  }, [lines]);

  const latest = lines.map((l) => ({ l, last: l.pts[l.pts.length - 1] })).filter((i) => i.last);
  const hasData = times.length > 0;

  // 수집이 끊긴 구간은 선을 잇지 않는다
  function segments(pts: { t: number; v: number }[]) {
    const result: { t: number; v: number }[][] = [];
    for (const p of pts) {
      const last = result[result.length - 1];
      if (last && p.t - last[last.length - 1].t <= bucketSeconds * 2500) last.push(p);
      else result.push([p]);
    }
    return result;
  }

  function path(seg: { t: number; v: number }[]) {
    return seg.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  }

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    if (!times.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = start + ((e.clientX - rect.left) / rect.width) * (now - start);
    let best = 0;
    for (let i = 1; i < times.length; i++) {
      if (Math.abs(times[i] - t) < Math.abs(times[best] - t)) best = i;
    }
    setHover(times[best]);
  }

  const hoverRows =
    hover === null
      ? []
      : lines
          .map((l) => ({ s: l.series, p: l.pts.find((p) => p.t === hover) }))
          .filter((r): r is { s: MetricSeries; p: { t: number; v: number } } => !!r.p)
          .sort((a, b) => b.p.v - a.p.v);

  const tooltipLeft = hover === null ? 0 : x(hover);
  const flip = tooltipLeft > width * 0.62;

  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-ink-900">{title}</p>
          <p className="mt-0.5 text-[12px] text-ink-400">
            {series.length === 1 ? series[0].agentName : `${series.length}대 서버`}
          </p>
        </div>
        <div className="text-right">
          {latest.length === 1 && (
            <p className="text-[22px] font-extrabold leading-none tracking-tight text-ink-900 tabular-nums">
              {Math.round(latest[0].last!.v)}
              <span className="ml-0.5 text-[13px] font-bold text-ink-400">%</span>
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="mt-1 text-[11px] font-semibold text-ink-400 hover:text-primary-600"
          >
            {showTable ? "그래프로 보기" : "표로 보기"}
          </button>
        </div>
      </div>

      {series.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-600">
          {series.map((s) => (
            <li key={s.agentId} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: colorOf(s.agentId, order) }} />
              {s.agentName}
            </li>
          ))}
        </ul>
      )}

      {showTable ? (
        <MetricTable series={series} metric={metric} />
      ) : (
        <div ref={ref} className="relative mt-3" style={{ height: HEIGHT }}>
          {width > 0 && (
            <svg width={width} height={HEIGHT} role="img" aria-label={`${title} 추이`}>
              {TICKS.map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#EEF0F3" />
                  <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-400 text-[10px] tabular-nums">
                    {t}%
                  </text>
                </g>
              ))}
              {[start, start + (now - start) / 2, now].map((t, i) => (
                <text
                  key={i}
                  x={x(t)}
                  y={HEIGHT - 6}
                  textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
                  className="fill-ink-400 text-[10px] tabular-nums"
                >
                  {i === 2 ? "지금" : hhmm(t)}
                </text>
              ))}

              {lines.map(({ series: s, pts }) => {
                const color = colorOf(s.agentId, order);
                const last = pts[pts.length - 1];
                return (
                  <g key={s.agentId}>
                    {segments(pts).map((seg, i) =>
                      seg.length > 1 ? (
                        <path
                          key={i}
                          d={path(seg)}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      ) : (
                        <circle key={i} cx={x(seg[0].t)} cy={y(seg[0].v)} r={2.5} fill={color} />
                      ),
                    )}
                    {last && hover === null && (
                      <circle cx={x(last.t)} cy={y(last.v)} r={3.5} fill={color} stroke="#fff" strokeWidth={2} />
                    )}
                  </g>
                );
              })}

              {hover !== null && (
                <>
                  <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="#8B95A1" strokeDasharray="3 3" />
                  {hoverRows.map((r) => (
                    <circle
                      key={r.s.agentId}
                      cx={x(r.p.t)}
                      cy={y(r.p.v)}
                      r={4}
                      fill={colorOf(r.s.agentId, order)}
                      stroke="#fff"
                      strokeWidth={2}
                    />
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

          {!hasData && width > 0 && (
            <p className="absolute inset-0 flex items-center justify-center pb-6 text-[12px] text-ink-400">
              이 기간에 받은 지표가 없습니다
            </p>
          )}

          {hover !== null && hoverRows.length > 0 && (
            <div
              className={cn(
                "pointer-events-none absolute top-0 z-10 min-w-[140px] rounded-lg bg-ink-900 px-3 py-2 text-[12px] text-white shadow-lift",
                flip ? "-translate-x-[calc(100%+10px)]" : "translate-x-[10px]",
              )}
              style={{ left: tooltipLeft }}
            >
              <p className="font-bold tabular-nums">{hhmm(hover)}</p>
              <ul className="mt-1 space-y-0.5">
                {hoverRows.map((r) => (
                  <li key={r.s.agentId} className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(r.s.agentId, order) }} />
                    <span className="min-w-0 flex-1 truncate text-ink-200">{r.s.agentName}</span>
                    <span className="font-bold tabular-nums">{r.p.v.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricTable({ series, metric }: { series: MetricSeries[]; metric: MetricKey }) {
  const rows = useMemo(() => {
    const map = new Map<string, Record<number, number | null | undefined>>();
    series.forEach((s) =>
      s.points.forEach((p: MetricBucket) => {
        const row = map.get(p.time) ?? {};
        row[s.agentId] = p[metric];
        map.set(p.time, row);
      }),
    );
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12);
  }, [series, metric]);

  if (!rows.length) {
    return <p className="mt-3 py-10 text-center text-[12px] text-ink-400">이 기간에 받은 지표가 없습니다</p>;
  }
  return (
    <div className="mt-3 max-h-[168px] overflow-auto">
      <table className="w-full text-[12px] tabular-nums">
        <thead className="sticky top-0 bg-white text-ink-400">
          <tr>
            <th className="py-1 text-left font-semibold">시각</th>
            {series.map((s) => (
              <th key={s.agentId} className="py-1 text-right font-semibold">
                {s.agentName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-ink-700">
          {rows.map(([time, row]) => (
            <tr key={time} className="border-t border-line">
              <td className="py-1">{hhmm(Date.parse(time))}</td>
              {series.map((s) => (
                <td key={s.agentId} className="py-1 text-right">
                  {row[s.agentId] == null ? "-" : `${row[s.agentId]!.toFixed(1)}%`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
