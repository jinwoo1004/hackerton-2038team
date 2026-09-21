"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, CalendarClock, FileStack, Play, ShieldCheck } from "lucide-react";
import { analysisApi } from "@/services/analysisApi";
import { useProject } from "@/features/project/ProjectContext";
import { CATEGORY_LABEL, TECH_GROUPS } from "@/features/project/techOptions";
import { formatDateTime } from "@/shared/lib/format";
import { Button, LinkButton } from "@/shared/ui/Button";
import { Card, CardBody, CardHeader, InfoRow } from "@/shared/ui/Card";
import { Chip } from "@/shared/ui/Badge";
import { StatCard, StatCardRow } from "@/shared/ui/StatCard";
import { AnalysisStatusBadge, analysisStatusLabel, projectStatusLabel } from "@/shared/ui/StatusBadge";
import { useToast } from "@/shared/ui/Toast";
import type { Analysis, TechCategory } from "@/types";

export default function ProjectOverviewPage() {
  const { project, patch } = useProject();
  const toast = useToast();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!project) return;
    let alive = true;
    analysisApi
      .latest(project.id)
      .then((a) => alive && setAnalysis(a))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [project]);

  if (!project) return null;

  const analysisStatus = analysis?.status ?? "READY";
  const running = analysisStatus === "QUEUED" || analysisStatus === "ANALYZING";

  async function startAnalysis() {
    if (!project) return;
    setStarting(true);
    try {
      const started = await analysisApi.start(project.id);
      setAnalysis(started);
      if (started.status === "FAILED") {
        toast.error(started.summary ?? "분석을 시작하지 못했습니다.");
        return;
      }
      patch({ status: "ANALYZING" });
      toast.success("분석을 시작했습니다.");
      router.push(`/projects/${project.id}/analysis`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "분석을 시작하지 못했습니다.");
    } finally {
      setStarting(false);
    }
  }

  const byCategory = TECH_GROUPS.map((g) => ({
    category: g.category as TechCategory,
    names: project.technologies.filter((t) => t.category === g.category).map((t) => t.name),
  }));

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      <StatCardRow>
        <StatCard
          label="프로젝트 상태"
          value={projectStatusLabel(project.status)}
          tone={project.status === "ERROR" ? "red" : project.status === "ACTIVE" ? "green" : "default"}
          icon={<ShieldCheck size={20} />}
        />
        <StatCard
          label="분석 상태"
          value={analysisStatusLabel(analysisStatus)}
          tone={running ? "blue" : analysisStatus === "COMPLETED" ? "green" : "default"}
          icon={<Activity size={20} />}
        />
        <StatCard label="등록 파일" value={`${project.fileCount}`} hint="규칙 문서 + 소스" icon={<FileStack size={20} />} />
        <StatCard
          label="최근 분석"
          value={project.lastAnalyzedAt ? formatDateTime(project.lastAnalyzedAt) : "-"}
          hint={project.lastAnalyzedAt ? undefined : "아직 분석하지 않았습니다"}
          icon={<CalendarClock size={20} />}
        />
      </StatCardRow>

      <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <Play size={20} strokeWidth={2} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold text-ink-900">프로젝트 분석</h3>
              <AnalysisStatusBadge status={analysisStatus} />
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
              {running
                ? "분석이 진행 중입니다. 완료되면 분석 탭에서 결과를 확인할 수 있습니다."
                : "등록한 소스와 규칙 문서를 기준으로 코드 품질, 오류, 로그, 성능을 분석합니다."}
            </p>
          </div>
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          <LinkButton variant="secondary" href={`/projects/${project.id}/analysis`}>
            분석 화면
          </LinkButton>
          <Button onClick={startAnalysis} loading={starting} disabled={running}>
            {running ? "분석 진행중" : "분석 시작"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="프로젝트 정보" />
        <CardBody className="py-1">
          <dl>
            {byCategory.map(({ category, names }) => (
              <InfoRow key={category} label={CATEGORY_LABEL[category]}>
                {names.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {names.map((n) => (
                      <Chip key={n}>{n}</Chip>
                    ))}
                  </span>
                ) : (
                  <span className="text-ink-300">-</span>
                )}
              </InfoRow>
            ))}
            <InfoRow label="설명">
              {project.description ? (
                <span className="leading-relaxed">{project.description}</span>
              ) : (
                <span className="text-ink-300">-</span>
              )}
            </InfoRow>
            <InfoRow label="Project Code">
              <span className="font-mono font-semibold">{project.projectCode}</span>
            </InfoRow>
            <InfoRow label="등록일">
              <span className="tabular-nums">{formatDateTime(project.createdAt)}</span>
            </InfoRow>
          </dl>
        </CardBody>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 backdrop-blur sm:hidden">
        <LinkButton variant="secondary" size="lg" href={`/projects/${project.id}/analysis`} className="flex-1">
          분석 화면
        </LinkButton>
        <Button size="lg" onClick={startAnalysis} loading={starting} disabled={running} className="flex-[2]">
          {running ? "분석 진행중" : "분석 시작"}
        </Button>
      </div>
    </div>
  );
}
