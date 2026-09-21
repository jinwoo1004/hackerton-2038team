import type { AnalysisStatus, ProjectStatus } from "@/types";
import { Badge, type BadgeTone } from "./Badge";

const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: BadgeTone }> = {
  READY: { label: "준비됨", tone: "gray" },
  ANALYZING: { label: "분석중", tone: "blue" },
  ACTIVE: { label: "운영중", tone: "green" },
  ERROR: { label: "오류", tone: "red" },
};

const ANALYSIS_STATUS: Record<AnalysisStatus, { label: string; tone: BadgeTone }> = {
  READY: { label: "분석 전", tone: "gray" },
  QUEUED: { label: "대기중", tone: "amber" },
  ANALYZING: { label: "분석중", tone: "blue" },
  COMPLETED: { label: "분석 완료", tone: "green" },
  FAILED: { label: "분석 실패", tone: "red" },
};

export function ProjectStatusBadge({ status, solid = false }: { status: ProjectStatus; solid?: boolean }) {
  const s = PROJECT_STATUS[status] ?? PROJECT_STATUS.READY;
  return (
    <Badge tone={s.tone} dot solid={solid}>
      {s.label}
    </Badge>
  );
}

export function AnalysisStatusBadge({ status, solid = false }: { status: AnalysisStatus; solid?: boolean }) {
  const s = ANALYSIS_STATUS[status] ?? ANALYSIS_STATUS.READY;
  return (
    <Badge tone={s.tone} dot solid={solid}>
      {s.label}
    </Badge>
  );
}

export function projectStatusLabel(status: ProjectStatus): string {
  return (PROJECT_STATUS[status] ?? PROJECT_STATUS.READY).label;
}

export function analysisStatusLabel(status: AnalysisStatus): string {
  return (ANALYSIS_STATUS[status] ?? ANALYSIS_STATUS.READY).label;
}
