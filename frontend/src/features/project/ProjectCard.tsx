import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, FileText, Folder, Plus } from "lucide-react";
import { ProjectMenu } from "@/features/project/ProjectMenu";
import { formatDate, formatDateTime } from "@/shared/lib/format";
import { Chip } from "@/shared/ui/Badge";
import { ProjectStatusBadge } from "@/shared/ui/StatusBadge";
import type { Project } from "@/types";

const MAX_CHIPS = 4;

export function ProjectCard({ project }: { project: Project }) {
  const techNames = project.technologies.map((t) => t.name);
  const shown = techNames.slice(0, MAX_CHIPS);
  const rest = techNames.length - shown.length;
  const href = `/projects/${project.id}`;

  return (
    <div className="group relative flex flex-col rounded-2xl border border-line bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-lift">
      <div className="flex items-center justify-between gap-2">
        <ProjectStatusBadge status={project.status} solid />
        <ProjectMenu projectId={project.id} name={project.name} className="relative z-10 -mr-1.5" />
      </div>

      <div className="mt-3 flex items-center gap-3.5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.8)]">
          <Folder size={22} strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-[17px] font-extrabold text-ink-900">
            <Link href={href} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">
              {project.name}
            </Link>
          </h3>
          <p className="truncate font-mono text-[12px] font-medium text-ink-400">{project.projectCode}</p>
        </div>
      </div>

      <p className="mt-3 truncate text-[13px] text-ink-500">{project.nickname || project.description || "설명이 없습니다."}</p>

      <div className="mt-3 flex min-h-[24px] flex-wrap gap-1.5">
        {shown.map((name) => (
          <Chip key={name}>{name}</Chip>
        ))}
        {rest > 0 && <Chip className="text-ink-400">+{rest}</Chip>}
        {shown.length === 0 && <span className="text-[12px] text-ink-300">등록된 기술 스택 없음</span>}
      </div>

      <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[13px]">
        {[
          { icon: Clock3, label: "최근 분석", value: project.lastAnalyzedAt ? formatDateTime(project.lastAnalyzedAt) : "분석 전" },
          { icon: FileText, label: "등록 파일", value: `${project.fileCount}건` },
          { icon: CalendarDays, label: "생성일", value: formatDate(project.createdAt) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-ink-400">
              <Icon size={14} className="text-ink-300" />
              {label}
            </dt>
            <dd className="font-semibold tabular-nums text-ink-700">{value}</dd>
          </div>
        ))}
      </dl>

      <span className="mt-4 flex h-10 items-center justify-center gap-1 rounded-xl border border-line text-[13px] font-bold text-primary-600 transition-colors group-hover:border-primary-600 group-hover:bg-primary-600 group-hover:text-white">
        프로젝트 열기
        <ArrowRight size={14} strokeWidth={2.4} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </div>
  );
}

export function NewProjectCard() {
  return (
    <Link
      href="/projects/new"
      className="group flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-white p-6 text-center transition hover:border-primary-400"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-white text-primary-600 shadow-soft transition group-hover:scale-105 group-hover:border-primary-600 group-hover:bg-primary-600 group-hover:text-white">
        <Plus size={26} strokeWidth={2.4} />
      </span>
      <span className="mt-4 text-[17px] font-extrabold text-ink-900">새 프로젝트 만들기</span>
      <span className="mt-2 text-[13px] leading-relaxed text-ink-500">
        프로젝트를 등록하고
        <br />
        분석을 시작해보세요.
      </span>
    </Link>
  );
}
