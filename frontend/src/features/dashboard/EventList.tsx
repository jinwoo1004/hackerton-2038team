import Link from "next/link";
import {
  BellRing,
  BellOff,
  Cable,
  CircleCheck,
  CircleX,
  FilePlus2,
  FileX2,
  FolderPlus,
  FolderX,
  PencilLine,
  Play,
  PlugZap,
  ServerCog,
  ServerOff,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { formatDateTime, formatRelative } from "@/shared/lib/format";
import { cn } from "@/shared/lib/cn";
import type { ActivityEvent, EventLevel, EventType } from "@/types";

export const TYPE_TEXT: Record<EventType, string> = {
  PROJECT_CREATED: "새로운 프로젝트가 생성되었습니다.",
  PROJECT_UPDATED: "프로젝트 정보가 변경되었습니다.",
  PROJECT_DELETED: "프로젝트와 관련 데이터가 삭제되었습니다.",
  FILE_UPLOADED: "분석에 쓸 파일이 등록되었습니다.",
  FILE_DELETED: "등록된 파일이 삭제되었습니다.",
  ANALYSIS_STARTED: "프로젝트 분석이 시작되었습니다.",
  ANALYSIS_COMPLETED: "프로젝트 코드 분석이 완료되었습니다.",
  ANALYSIS_FAILED: "분석을 끝내지 못했습니다.",
  AGENT_REGISTERED: "새로운 에이전트가 프로젝트에 등록되었습니다.",
  AGENT_DELETED: "에이전트가 프로젝트에서 삭제되었습니다.",
  AGENT_CONNECTED: "에이전트가 서버와 연결되었습니다.",
  AGENT_DISCONNECTED: "에이전트 신호가 끊겼습니다.",
  INCIDENT_OPENED: "자동 탐지 규칙에 걸린 이상이 기록되었습니다.",
  INCIDENT_RESOLVED: "기록된 이상이 해결되었습니다.",
  ALERT_SENT: "담당자에게 알림을 보냈습니다.",
  ALERT_FAILED: "알림 채널로 보내지 못했습니다.",
};

export function eventLink(e: ActivityEvent): string | null {
  if (e.type === "INCIDENT_OPENED" || e.type === "INCIDENT_RESOLVED") return "/monitoring";
  if (e.type === "ALERT_SENT" || e.type === "ALERT_FAILED") return "/settings/alerts";
  if (!e.projectId || e.type === "PROJECT_DELETED") return null;
  if (e.type.startsWith("ANALYSIS_")) return `/projects/${e.projectId}/analysis`;
  if (e.type.startsWith("FILE_")) return `/projects/${e.projectId}/files`;
  if (e.type.startsWith("AGENT_")) return `/projects/${e.projectId}/agents`;
  return `/projects/${e.projectId}`;
}

export const TYPE_ICON: Record<EventType, LucideIcon> = {
  PROJECT_CREATED: FolderPlus,
  PROJECT_UPDATED: PencilLine,
  PROJECT_DELETED: FolderX,
  FILE_UPLOADED: FilePlus2,
  FILE_DELETED: FileX2,
  ANALYSIS_STARTED: Play,
  ANALYSIS_COMPLETED: CircleCheck,
  ANALYSIS_FAILED: CircleX,
  AGENT_REGISTERED: ServerCog,
  AGENT_DELETED: ServerOff,
  AGENT_CONNECTED: PlugZap,
  AGENT_DISCONNECTED: Cable,
  INCIDENT_OPENED: ShieldAlert,
  INCIDENT_RESOLVED: ShieldCheck,
  ALERT_SENT: BellRing,
  ALERT_FAILED: BellOff,
};

export const LEVEL_META: Record<EventLevel, { label: string; icon: string; badge: string }> = {
  INFO: { label: "정보", icon: "bg-primary-50 text-primary-600", badge: "bg-ink-100 text-ink-500" },
  WARNING: { label: "주의", icon: "bg-toss-amber-soft text-toss-amber", badge: "bg-toss-amber-soft text-toss-amber" },
  ERROR: { label: "오류", icon: "bg-toss-red-soft text-toss-red", badge: "bg-toss-red-soft text-toss-red" },
};

export function EventList({
  events,
  compact = false,
  showProject = true,
}: {
  events: ActivityEvent[];
  compact?: boolean;
  showProject?: boolean;
}) {
  return (
    <ul>
      {events.map((e) => {
        const Icon = TYPE_ICON[e.type] ?? Play;
        const level = LEVEL_META[e.level];
        const projectLink = e.projectId && e.type !== "PROJECT_DELETED" ? `/projects/${e.projectId}` : null;
        return (
          <li key={e.id} className={cn("flex items-start gap-3 border-b border-line last:border-0", compact ? "py-3" : "py-3.5")}>
            <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", level.icon)}>
              <Icon size={15} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] font-semibold text-ink-900">
                {e.title}
                {e.level !== "INFO" && (
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-bold", level.badge)}>{level.label}</span>
                )}
              </p>
              <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] text-ink-400">
                {showProject && e.projectName && (
                  projectLink ? (
                    <Link href={projectLink} className="font-semibold text-ink-600 hover:text-primary-600">
                      {e.projectName}
                    </Link>
                  ) : (
                    <span className="font-semibold text-ink-500">{e.projectName}</span>
                  )
                )}
                {e.message && <span className="min-w-0 truncate">{e.message}</span>}
              </p>
            </div>
            <time
              dateTime={e.createdAt}
              title={formatDateTime(e.createdAt)}
              className="shrink-0 text-[12px] tabular-nums text-ink-400"
            >
              {formatRelative(e.createdAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
