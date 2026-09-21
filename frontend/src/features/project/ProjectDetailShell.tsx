"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PROJECT_TABS } from "@/widgets/layout/nav";
import { useSetCrumb } from "@/widgets/layout/CrumbContext";
import { cn } from "@/shared/lib/cn";
import { ErrorState } from "@/shared/ui/EmptyState";
import { Skeleton } from "@/shared/ui/Skeleton";
import { ProjectStatusBadge } from "@/shared/ui/StatusBadge";
import { useProject } from "./ProjectContext";

export function ProjectDetailShell({ children }: { children: React.ReactNode }) {
  const { project, state, error, reload } = useProject();
  const pathname = usePathname() ?? "";
  useSetCrumb(project?.name);

  if (state === "loading") {
    return (
      <div>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-4 h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-40" />
        <Skeleton className="mt-6 h-11 w-full rounded-xl" />
        <Skeleton className="mt-6 h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (state === "error" || !project) {
    return (
      <ErrorState
        title="프로젝트를 불러오지 못했습니다."
        description={error || "잠시 후 다시 시도해주세요."}
        onRetry={reload}
      />
    );
  }

  const base = `/projects/${project.id}`;

  return (
    <div>
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-400 transition-colors hover:text-ink-900"
      >
        <ArrowLeft size={14} />
        프로젝트 목록
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-[24px] font-bold tracking-tight text-ink-900 sm:text-[28px]">
              {project.name}
            </h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          {project.nickname && <p className="mt-1 text-sm text-ink-500">{project.nickname}</p>}
        </div>
        <div className="shrink-0 rounded-lg border border-line bg-white px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Project Code</p>
          <p className="mt-0.5 font-mono text-[13px] font-bold text-ink-900">{project.projectCode}</p>
        </div>
      </div>

      <nav className="no-scrollbar -mx-4 mt-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1">
          {PROJECT_TABS.map((tab) => {
            const href = `${base}${tab.segment}`;
            const active = tab.segment === "" ? pathname === base : pathname.startsWith(href);
            if (tab.soon) {
              return (
                <li key={tab.key}>
                  <span
                    title={`${tab.label} — 준비중`}
                    className="flex h-11 cursor-not-allowed items-center gap-1.5 px-3 text-sm font-medium text-ink-300"
                  >
                    {tab.label}
                    <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-400">
                      준비중
                    </span>
                  </span>
                </li>
              );
            }
            return (
              <li key={tab.key}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center border-b-2 px-3 text-sm transition-colors",
                    active
                      ? "border-primary-600 font-bold text-primary-700"
                      : "border-transparent font-medium text-ink-500 hover:text-ink-900",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6">{children}</div>
    </div>
  );
}
