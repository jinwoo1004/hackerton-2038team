"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { formatDateTime, formatRelative } from "@/shared/lib/format";
import { cn } from "@/shared/lib/cn";
import type { Incident } from "@/types";
import { INCIDENT_SEVERITY } from "./meta";

export function IncidentList({
  incidents,
  onResolve,
  resolving,
  showProject = true,
}: {
  incidents: Incident[];
  onResolve?: (incident: Incident) => void;
  resolving?: number | null;
  showProject?: boolean;
}) {
  return (
    <ul>
      {incidents.map((i) => {
        const sev = INCIDENT_SEVERITY[i.severity];
        const Icon = i.status === "RESOLVED" ? CheckCircle2 : sev.icon;
        const open = i.status === "OPEN";
        return (
          <li key={i.id} className="flex items-start gap-3 border-b border-line px-5 py-4 last:border-0">
            <span
              className={cn(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                open ? cn(sev.soft, sev.text) : "bg-ink-100 text-ink-400",
              )}
            >
              <Icon size={17} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-bold text-ink-900">
                <span className="min-w-0">{i.title}</span>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                    open ? cn(sev.soft, sev.text) : "bg-ink-100 text-ink-500",
                  )}
                >
                  {open ? sev.label : "해결"}
                </span>
              </p>
              {i.detail && <p className="mt-1 break-all font-mono text-[12px] leading-relaxed text-ink-500">{i.detail}</p>}
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-400">
                <span className="font-semibold text-ink-500">{i.ruleLabel}</span>
                {showProject && i.projectName && (
                  <Link href={`/projects/${i.projectId}`} className="font-semibold text-ink-600 hover:text-primary-600">
                    {i.projectName}
                  </Link>
                )}
                {i.agentName && <span>{i.agentName}</span>}
                <span title={formatDateTime(i.openedAt)}>발생 {formatRelative(i.openedAt)}</span>
                {!open && i.resolvedAt && (
                  <span>
                    {i.resolvedBy === "USER" ? "직접 해결" : "자동 해결"} {formatRelative(i.resolvedAt)}
                  </span>
                )}
              </p>
            </div>
            {open && onResolve && (
              <button
                type="button"
                onClick={() => onResolve(i)}
                disabled={resolving === i.id}
                className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-600 transition hover:bg-ink-100 disabled:opacity-50"
              >
                해결 처리
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
