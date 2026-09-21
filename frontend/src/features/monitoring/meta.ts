import { AlertOctagon, AlertTriangle, type LucideIcon } from "lucide-react";
import type { AgentState, IncidentRule, IncidentSeverity, LogLevel } from "@/types";

export const AGENT_STATE: Record<AgentState, { label: string; tone: string; dot: string }> = {
  ONLINE: { label: "수집 중", tone: "bg-toss-green-soft text-toss-green", dot: "bg-toss-green" },
  OFFLINE: { label: "연결 끊김", tone: "bg-toss-red-soft text-toss-red", dot: "bg-toss-red" },
  PENDING: { label: "연결 대기", tone: "bg-ink-100 text-ink-500", dot: "bg-ink-300" },
};

export const INCIDENT_SEVERITY: Record<IncidentSeverity, { label: string; icon: LucideIcon; text: string; soft: string }> = {
  CRITICAL: { label: "심각", icon: AlertOctagon, text: "text-toss-red", soft: "bg-toss-red-soft" },
  WARNING: { label: "주의", icon: AlertTriangle, text: "text-toss-amber", soft: "bg-toss-amber-soft" },
};

export const INCIDENT_RULES: { value: IncidentRule; label: string; description: string }[] = [
  { value: "AGENT_DOWN", label: "에이전트 연결 끊김", description: "2분 넘게 신호가 없을 때" },
  { value: "CPU_HIGH", label: "CPU 사용률 높음", description: "5분 평균 90% 이상" },
  { value: "MEMORY_HIGH", label: "메모리 사용률 높음", description: "5분 평균 90% 이상" },
  { value: "DISK_HIGH", label: "디스크 사용률 높음", description: "90% 이상" },
  { value: "ERROR_BURST", label: "오류 로그 급증", description: "5분 동안 오류 20건 이상" },
  { value: "FATAL_LOG", label: "치명 로그 발생", description: "FATAL 로그가 들어왔을 때" },
  { value: "NEW_ERROR", label: "처음 보는 오류", description: "이전에 없던 오류 유형" },
  { value: "ERROR_SPIKE", label: "오류 추세 이상", description: "평소 대비 오류가 크게 늘었을 때" },
  { value: "CPU_SPIKE", label: "CPU 추세 이상", description: "평소 대비 CPU 가 크게 올랐을 때" },
];

export const LOG_LEVEL: Record<LogLevel, { label: string; tone: string }> = {
  FATAL: { label: "FATAL", tone: "bg-toss-red text-white" },
  ERROR: { label: "ERROR", tone: "bg-toss-red-soft text-toss-red" },
  WARN: { label: "WARN", tone: "bg-toss-amber-soft text-toss-amber" },
  INFO: { label: "INFO", tone: "bg-primary-50 text-primary-700" },
  DEBUG: { label: "DEBUG", tone: "bg-ink-100 text-ink-500" },
  TRACE: { label: "TRACE", tone: "bg-ink-100 text-ink-400" },
  UNKNOWN: { label: "LOG", tone: "bg-ink-100 text-ink-400" },
};

export function usageTone(value?: number | null): string {
  if (value == null) return "bg-ink-200";
  if (value >= 90) return "bg-toss-red";
  if (value >= 75) return "bg-toss-amber";
  return "bg-primary-500";
}

export function formatPct(value?: number | null): string {
  if (value == null) return "-";
  return `${Math.round(value)}%`;
}

export function formatRate(kbps?: number | null): string {
  if (kbps == null) return "-";
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} Mbps`;
  return `${Math.round(kbps)} Kbps`;
}
