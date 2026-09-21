import type { Incident, IncidentInsight, MetricBucket } from "@/types";

export const DEMO_CODE = "WALLPAD-DEMO";
export type DemoScenario = "LATENCY" | "ERROR_SPIKE";
export function seededMetrics(anchor: string): MetricBucket[] {
  const start = Date.parse(anchor) - 59 * 60_000;
  return Array.from({ length: 60 }, (_, i) => ({ time: new Date(start + i * 60_000).toISOString(), cpuPct: 28 + (i * 7 % 13), memoryPct: 54 + (i * 3 % 9), diskPct: Math.round((42 + i * .05) * 100) / 100, netInKbps: 120 + i, netOutKbps: 85 + i }));
}

export function localInsight(scenario: DemoScenario, serverName = "wallpad-demo-01"): IncidentInsight {
  const latency = scenario === "LATENCY";
  const baselineResponseMs = 120;
  const currentResponseMs = latency ? 3200 : 450;
  const timeoutCount = latency ? 8 : 2;
  const errorCount = latency ? 3 : 24;
  return {
    source: "LOCAL", serverName, baselineResponseMs, currentResponseMs, timeoutCount, errorCount, severity: "CRITICAL",
    summary: `${serverName}의 응답시간이 평소 ${baselineResponseMs}ms에서 ${currentResponseMs}ms로 늘었고, 최근 수집 구간에 Timeout ${timeoutCount}건과 오류 ${errorCount}건이 관찰되었습니다. ${latency ? "응답 지연과 시간 초과가 함께 나타나 연결 대기 상태를 우선 확인해야 합니다." : "오류가 집중되어 월패드 연동 요청과 응답 형식을 우선 확인해야 합니다."}`,
    evidence: [`응답시간 ${baselineResponseMs}ms → ${currentResponseMs}ms (${(currentResponseMs / baselineResponseMs).toFixed(1)}배)`, `동일 관찰 구간: Timeout ${timeoutCount}건 · 오류 ${errorCount}건`, "합성 시연 로그와 수집 지표를 근거로 생성한 설명입니다."],
    causes: latency ? ["연동 대상의 응답 대기 또는 요청 처리 지연 가능성", "재시도로 인한 연결 대기 누적 가능성"] : ["요청 필드·명령 코드·응답 형식 불일치 가능성", "반복 실패 요청의 재시도 집중 가능성"],
    actions: latency ? ["같은 시간대의 Timeout 로그와 요청 식별자를 대조하세요.", "연결 제한시간과 재시도 횟수를 확인하고, 복구 후 응답시간을 비교하세요."] : ["오류 로그의 copy 필드와 명령 코드를 연동 규격과 대조하세요.", "오류 요청을 분리하고 복구 후 오류 건수가 증가하지 않는지 확인하세요."],
  };
}

export function slackMessage(incident: Incident): string {
  const insight = incident.insight;
  if (!insight) return `[${incident.status === "OPEN" ? "발생" : "해결"}] ${incident.title}\n${incident.detail ?? ""}`;
  return `[${incident.status === "OPEN" ? "위험 감지" : "복구 완료"}] ${incident.projectName} · ${insight.serverName}\n${insight.summary}\n\n관찰 근거: ${insight.evidence.join(". ")}\n가능 원인: ${insight.causes.join(". ")}\n권장 조치: ${insight.actions.join(" ")}${incident.status === "RESOLVED" ? "\n이 사건은 해결 처리되었습니다. 위 수치는 발생 당시의 관찰 기록입니다." : ""}`;
}
