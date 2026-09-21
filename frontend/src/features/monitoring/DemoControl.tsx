"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FlaskConical, RefreshCw, Zap } from "lucide-react";
import { demoApi, DATA_CHANGED } from "@/services/demoApi";
import { projectApi } from "@/services/projectApi";
import { USE_MOCK } from "@/shared/config/app";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { useToast } from "@/shared/ui/Toast";
import { IncidentList } from "./IncidentList";
import type { Incident } from "@/types";

export function DemoControl({ showIncident = true }: { showIncident?: boolean }) {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const toast = useToast();
  useEffect(() => {
    const update = () => { projectApi.list().then((items) => setProjectId(items.find((p) => p.projectCode === "WALLPAD-DEMO")?.id ?? null)).catch(() => {}); };
    update(); window.addEventListener(DATA_CHANGED, update);
    return () => window.removeEventListener(DATA_CHANGED, update);
  }, []);
  async function run(action: "SEED" | "LATENCY" | "ERROR_SPIKE" | "RECOVER" | "RESET") {
    setBusy(action);
    const start = performance.now();
    try {
      if (action === "SEED") { const seed = await demoApi.seed(); setProjectId(seed.projectId); toast.success("시연 데이터와 ONLINE 에이전트를 준비했습니다."); }
      else if (action === "RESET") { await demoApi.reset(); setProjectId(null); setIncident(null); setElapsed(null); toast.success("이 계정의 시연 데이터를 초기화했습니다. 다시 준비하면 같은 시나리오로 시작합니다."); }
      else if (projectId && action === "RECOVER") { await demoApi.recover(projectId); setIncident(null); toast.success("시연 서버를 복구했습니다. 상태와 이벤트가 갱신됩니다."); }
      else if (projectId) { setIncident(await demoApi.trigger(projectId, action as "LATENCY" | "ERROR_SPIKE")); setElapsed(performance.now() - start); toast.success("합성 이상이 감지되었습니다. AI 설명과 Slack 미리보기를 확인하세요."); }
    } catch (error) { toast.error(error instanceof Error ? error.message : "시연 요청을 처리하지 못했습니다."); }
    finally { setBusy(null); }
  }
  return <Card className="overflow-hidden">
    <div className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-[15px] font-bold text-ink-900"><FlaskConical size={17} className="text-primary-600" /> 안전 장애 시연</h2><p className="mt-1 text-[12px] text-ink-500">합성 데이터로 응답 지연·오류 급증을 재현합니다. 실제 서버에는 영향을 주지 않습니다.</p></div>
        <span className="rounded-md bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-500">{USE_MOCK ? "브라우저 단독 · 로컬 분석" : "전체 스택 연결"}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={projectId ? "secondary" : "primary"} loading={busy === "SEED"} disabled={!!busy} onClick={() => run("SEED")}>{projectId ? "시연 데이터 확인" : "시연 데이터 준비"}</Button>
        <Button size="sm" variant="subtle" disabled={!projectId || !!busy} loading={busy === "LATENCY"} onClick={() => run("LATENCY")}><Zap size={14} />응답 지연 트리거</Button>
        <Button size="sm" variant="subtle" disabled={!projectId || !!busy} loading={busy === "ERROR_SPIKE"} onClick={() => run("ERROR_SPIKE")}><Zap size={14} />오류 급증 트리거</Button>
        <Button size="sm" variant="secondary" disabled={!projectId || !!busy} loading={busy === "RECOVER"} onClick={() => run("RECOVER")}><RefreshCw size={14} />정상 복구</Button>
        {USE_MOCK && projectId && <Button size="sm" variant="ghost" disabled={!!busy} loading={busy === "RESET"} onClick={() => run("RESET")}>데모 초기화</Button>}
        {projectId && <span className="ml-auto flex gap-3 text-[12px] font-semibold text-primary-600"><Link href={`/projects/${projectId}/analysis`}>분석 결과</Link><Link href={`/projects/${projectId}/logs`}>수집 로그</Link></span>}
      </div>
      {elapsed !== null && incident && <p className="mt-2 text-[11px] text-ink-400" role="status">Incident 생성 및 설명 표시: {(elapsed / 1000).toFixed(2)}초</p>}
    </div>
    {showIncident && incident && <div className="border-t border-line"><IncidentList incidents={[incident]} /></div>}
  </Card>;
}
