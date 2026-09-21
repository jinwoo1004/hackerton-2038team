"use client";

import { useCallback, useEffect, useState } from "react";
import { DATA_CHANGED } from "@/services/demoApi";
import { telemetryApi } from "@/services/agentApi";
import { incidentApi } from "@/services/alertApi";
import { Card } from "@/shared/ui/Card";
import { cn } from "@/shared/lib/cn";
import type { HealthSummary, Incident, IncidentTrend } from "@/types";

export function LiveHealthSummary() {
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [trend, setTrend] = useState<IncidentTrend[]>([]);
  const [error, setError] = useState(false);
  const refresh = useCallback(() => {
    Promise.all([telemetryApi.overview(), incidentApi.list({ limit: 300 })]).then(([overview, incidents]) => {
      let warning = 0, critical = 0;
      for (const project of overview.projects) {
        const active = incidents.filter((i) => i.projectId === project.projectId && i.status === "OPEN");
        if (active.some((i) => i.severity === "CRITICAL")) critical++;
        else if (active.length) warning++;
      }
      setHealth(overview.health ?? { total: overview.projects.length, normal: overview.projects.length - critical - warning, critical, warning, openIncidents: overview.openIncidents });
      setTrend(overview.incidentTrend ?? buildTrend(incidents));
      setError(false);
    }).catch(() => setError(true));
  }, []);
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener(DATA_CHANGED, refresh); window.addEventListener("storage", refresh);
    return () => { clearInterval(timer); window.removeEventListener(DATA_CHANGED, refresh); window.removeEventListener("storage", refresh); };
  }, [refresh]);
  if (!health) return error ? <p className="text-[12px] text-toss-red">운영 상태를 불러오지 못했습니다. 잠시 후 다시 확인합니다.</p> : null;
  return <Card className="p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-[15px] font-bold text-ink-900">실시간 프로젝트 상태</h2><p className="text-[12px] text-ink-400">진행 중인 incident 기준 · {error ? "갱신 지연" : "5초마다 갱신"}</p></div>
    <dl className="mt-3 grid grid-cols-4 divide-x divide-line">
      {[["전체", health.total, "text-ink-900"], ["정상", health.normal, "text-toss-green"], ["주의", health.warning, "text-toss-amber"], ["위험", health.critical, "text-toss-red"]].map(([label, value, color]) => <div key={String(label)} className="px-4 first:pl-0"><dt className="text-[12px] font-semibold text-ink-500">{label}</dt><dd className={cn("mt-1 text-[24px] font-extrabold tabular-nums", String(color))}>{value}<span className="ml-1 text-[12px] font-medium text-ink-400">개</span></dd></div>)}
    </dl>
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex flex-wrap justify-between gap-2 text-[12px]"><h3 className="font-semibold text-ink-700">최근 7일 이상 이벤트 추이</h3><span className="text-ink-500">진행 중 {health.openIncidents}건 · <span className="text-toss-red">발생</span> / <span className="text-toss-green">해결</span></span></div>
      <div className="mt-3 grid grid-cols-7 gap-2" role="img" aria-label="최근 7일 이상 발생 및 해결 건수">
        {trend.slice(-7).map((day) => { const max = Math.max(1, ...trend.flatMap((d) => [d.opened, d.resolved])); return <div key={day.date} className="text-center"><div className="flex h-10 items-end justify-center gap-1"><div className="w-3 rounded-t-sm bg-toss-red" style={{ height: day.opened ? `${Math.max(8, day.opened / max * 100)}%` : 2 }} /><div className="w-3 rounded-t-sm bg-toss-green" style={{ height: day.resolved ? `${Math.max(8, day.resolved / max * 100)}%` : 2 }} /></div><p className="mt-1 text-[11px] font-bold tabular-nums text-ink-600">{day.opened} / {day.resolved}</p><p className="text-[10px] text-ink-400">{day.date.slice(5)}</p></div>; })}
      </div>
    </div>
  </Card>;
}

function buildTrend(incidents: Incident[]): IncidentTrend[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - (6 - i) * 86400_000).toLocaleDateString("sv-SE");
    const dayOf = (value?: string | null) => value ? new Date(value).toLocaleDateString("sv-SE") : "";
    return { date, opened: incidents.filter((x) => dayOf(x.openedAt) === date).length, resolved: incidents.filter((x) => x.status === "RESOLVED" && dayOf(x.resolvedAt) === date).length };
  });
}
