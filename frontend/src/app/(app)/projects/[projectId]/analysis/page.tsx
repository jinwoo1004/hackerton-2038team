"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bug,
  FileCode2,
  Gauge,
  History,
  RotateCcw,
  ScrollText,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { analysisApi } from "@/services/analysisApi";
import { AnalysisResultView } from "@/features/analysis/AnalysisResultView";
import { useProject } from "@/features/project/ProjectContext";
import { formatDateTime } from "@/shared/lib/format";
import { Button } from "@/shared/ui/Button";
import { Card, CardBody, CardHeader } from "@/shared/ui/Card";
import { EmptyState, ErrorState } from "@/shared/ui/EmptyState";
import { Skeleton } from "@/shared/ui/Skeleton";
import { AnalysisStatusBadge } from "@/shared/ui/StatusBadge";
import { useToast } from "@/shared/ui/Toast";
import type { Analysis } from "@/types";

type LoadState = "loading" | "ready" | "error";

const POLL_MS = 2500;

const PANELS: { key: string; title: string; description: string; icon: LucideIcon }[] = [
  { key: "quality", title: "코드 품질", description: "긴 파일·함수, 긴 줄, 남은 TODO", icon: FileCode2 },
  { key: "errors", title: "오류 위험", description: "예외 처리 누락, 디버그 출력", icon: Bug },
  { key: "security", title: "보안 이슈", description: "비밀값 노출, SQL 조립, 위험한 호출", icon: ShieldAlert },
  { key: "performance", title: "성능", description: "SELECT *, sleep, 동기 I/O", icon: Gauge },
  { key: "rules", title: "프로젝트 규칙", description: "규칙 문서의 금지·기준 위반", icon: Sparkles },
  { key: "logs", title: "로그", description: "반복되는 오류·치명 로그", icon: ScrollText },
];

const isRunning = (a: Analysis | null) => a?.status === "QUEUED" || a?.status === "ANALYZING";

export default function ProjectAnalysisPage() {
  const { project, refresh } = useProject();
  const toast = useToast();

  const [state, setState] = useState<LoadState>("loading");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const projectId = project?.id;

  const load = useCallback(() => {
    if (!projectId) return;
    setState("loading");
    Promise.all([analysisApi.latest(projectId), analysisApi.history(projectId)])
      .then(([latest, list]) => {
        setAnalysis(latest);
        setHistory(list);
        setState("ready");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "분석 정보를 불러오지 못했습니다.");
        setState("error");
      });
  }, [projectId]);

  useEffect(load, [load]);

  const running = isRunning(analysis);

  useEffect(() => {
    if (!projectId || !running) return;
    const timer = setInterval(() => {
      analysisApi
        .latest(projectId)
        .then((latest) => {
          if (isRunning(latest)) return;
          setAnalysis(latest);
          analysisApi.history(projectId).then(setHistory).catch(() => {});
          refresh();
          if (latest?.status === "COMPLETED") toast.success("분석이 완료되었습니다.");
          else if (latest?.status === "FAILED") toast.error("분석에 실패했습니다.");
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [projectId, running, refresh, toast]);

  if (!project) return null;

  async function start() {
    if (!projectId) return;
    setStarting(true);
    try {
      const started = await analysisApi.start(projectId);
      setAnalysis(started);
      setHistory((prev) => [started, ...prev]);
      if (started.status === "FAILED") {
        toast.error(started.summary ?? "분석을 시작하지 못했습니다.");
      } else {
        refresh();
        toast.success("분석을 시작했습니다.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "분석을 시작하지 못했습니다.");
    } finally {
      setStarting(false);
    }
  }

  if (state === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PANELS.map((p) => (
            <Skeleton key={p.key} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (state === "error") {
    return <ErrorState title="분석 정보를 불러오지 못했습니다." description={error} onRetry={load} />;
  }

  if (!analysis) {
    return (
      <div className="pb-24 sm:pb-0">
        <EmptyState
          tone="hero"
          icon={Sparkles}
          title="아직 분석 결과가 없습니다."
          description={
            <>
              프로젝트 분석을 실행하면
              <br />
              코드 품질, 오류, 보안, 성능과 규칙 위반을 확인할 수 있습니다.
            </>
          }
          action={
            <Button size="lg" onClick={start} loading={starting}>
              분석 시작
            </Button>
          }
        />

        <div className="mt-6">
          <h3 className="mb-3 text-[13px] font-bold text-ink-400">분석이 완료되면 아래 항목을 볼 수 있습니다</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {PANELS.map((p) => (
              <PanelPlaceholder key={p.key} title={p.title} description={p.description} icon={p.icon} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const completed = analysis.status === "COMPLETED";
  const failed = analysis.status === "FAILED";

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3.5">
          <span
            className={
              failed
                ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-toss-red-soft text-toss-red"
                : "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"
            }
          >
            {running ? <Activity size={20} className="animate-pulse" /> : failed ? <TriangleAlert size={20} /> : <Sparkles size={20} />}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-bold text-ink-900">
                {running ? "소스를 분석하고 있어요" : failed ? "분석에 실패했어요" : "분석 결과"}
              </h3>
              <AnalysisStatusBadge status={analysis.status} />
            </div>
            <p className="mt-1 text-[13px] text-ink-500">
              {running
                ? "파일 크기에 따라 몇 초에서 몇 분이 걸립니다. 완료되면 자동으로 표시됩니다."
                : completed
                  ? `분석 완료 ${formatDateTime(analysis.completedAt)}`
                  : analysis.summary ?? "분석이 완료되지 않았습니다. 다시 실행할 수 있습니다."}
            </p>
          </div>
        </div>
        <Button onClick={start} loading={starting} disabled={running} className="hidden sm:inline-flex">
          <RotateCcw size={15} />
          {running ? "분석 진행중" : "다시 분석"}
        </Button>
      </Card>

      {running && (
        <>
          <div className="h-1 overflow-hidden rounded-full bg-toss-line2">
            <div className="h-full w-2/5 animate-indeterminate rounded-full bg-primary-600" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {PANELS.map((p) => (
              <Card key={p.key} className="p-5">
                <div className="flex items-center gap-2">
                  <p.icon size={16} className="text-ink-300" />
                  <span className="text-[13px] font-bold text-ink-500">{p.title}</span>
                </div>
                <Skeleton className="mt-4 h-7 w-24" />
                <Skeleton className="mt-2.5 h-3.5 w-full" />
                <Skeleton className="mt-1.5 h-3.5 w-2/3" />
              </Card>
            ))}
          </div>
        </>
      )}

      {completed && analysis.result && (
        <AnalysisResultView result={analysis.result} summary={analysis.summary} projectId={project.id} />
      )}

      {completed && !analysis.result && (
        <Card>
          <CardHeader title="분석 요약" description="이전 버전에서 실행한 분석이라 상세 결과가 없습니다. 다시 분석해주세요." />
          <CardBody>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{analysis.summary ?? "-"}</p>
          </CardBody>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader title="분석 이력" description={`총 ${history.length}건`} />
          <CardBody className="py-1">
            <ul>
              {history.slice(0, 10).map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <History size={15} className="shrink-0 text-ink-300" />
                    <span className="shrink-0 text-[13px] tabular-nums text-ink-700">{formatDateTime(h.startedAt ?? h.createdAt)}</span>
                    {h.status === "FAILED" && h.summary && (
                      <span className="hidden truncate text-[12px] text-ink-400 md:inline">{h.summary}</span>
                    )}
                  </span>
                  <AnalysisStatusBadge status={h.status} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 backdrop-blur sm:hidden">
        <Button size="lg" onClick={start} loading={starting} disabled={running} className="w-full">
          {running ? "분석 진행중" : "다시 분석"}
        </Button>
      </div>
    </div>
  );
}

function PanelPlaceholder({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-toss-soft/50 p-5">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-ink-300" />
        <span className="text-[13px] font-bold text-ink-600">{title}</span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-400">{description}</p>
    </div>
  );
}
