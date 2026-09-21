"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ScrollText } from "lucide-react";
import { agentApi } from "@/services/agentApi";
import { analysisApi } from "@/services/analysisApi";
import { fileApi } from "@/services/fileApi";
import { LiveLogStream } from "@/features/monitoring/LiveLogStream";
import { useProject } from "@/features/project/ProjectContext";
import { UPLOAD_LIMITS } from "@/shared/config/app";
import { cn } from "@/shared/lib/cn";
import { formatBytes, formatDateTime } from "@/shared/lib/format";
import { Button } from "@/shared/ui/Button";
import { Card, CardBody, CardHeader } from "@/shared/ui/Card";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ErrorState } from "@/shared/ui/EmptyState";
import { FileDropzone } from "@/shared/ui/FileDropzone";
import { Skeleton } from "@/shared/ui/Skeleton";
import { useToast } from "@/shared/ui/Toast";
import type { Agent, Analysis, LogStats, ProjectFile } from "@/types";

type LoadState = "loading" | "ready" | "error";

const ERROR_COLOR = "#d03b3b";
const WARN_COLOR = "#e39a0c";

export default function ProjectLogsPage() {
  const { project, patch, refresh } = useProject();
  const toast = useToast();
  const router = useRouter();

  const [state, setState] = useState<LoadState>("loading");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<{ name: string; percent: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProjectFile | null>(null);
  const [starting, setStarting] = useState(false);

  const projectId = project?.id;

  const load = useCallback(() => {
    if (!projectId) return;
    setState("loading");
    Promise.all([fileApi.list(projectId), analysisApi.latest(projectId)])
      .then(([list, latest]) => {
        setFiles(list.filter((f) => f.fileType === "LOG"));
        setAnalysis(latest);
        setState("ready");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "로그 정보를 불러오지 못했습니다.");
        setState("error");
      });
  }, [projectId]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!projectId) return;
    agentApi.list(projectId).then(setAgents).catch(() => setAgents([]));
  }, [projectId]);

  if (!project) return null;

  async function upload(picked: File[]) {
    if (!projectId) return;
    for (const file of picked) {
      setUploading({ name: file.name, percent: 0 });
      try {
        const saved = await fileApi.upload(projectId, file, "LOG", (percent) => setUploading({ name: file.name, percent }));
        setFiles((prev) => [...prev, saved]);
        patch({ fileCount: (project?.fileCount ?? 0) + 1 });
        toast.success(`${file.name} 업로드 완료`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `${file.name} 업로드에 실패했습니다.`);
      }
    }
    setUploading(null);
  }

  async function remove(file: ProjectFile) {
    if (!projectId) return;
    try {
      await fileApi.remove(projectId, file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      patch({ fileCount: Math.max(0, (project?.fileCount ?? 1) - 1) });
      toast.success("로그 파일을 삭제했습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제하지 못했습니다.");
    }
  }

  async function analyze() {
    if (!projectId) return;
    setStarting(true);
    try {
      const started = await analysisApi.start(projectId);
      if (started.status === "FAILED") {
        toast.error(started.summary ?? "분석을 시작하지 못했습니다.");
        return;
      }
      refresh();
      router.push(`/projects/${projectId}/analysis`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "분석을 시작하지 못했습니다.");
    } finally {
      setStarting(false);
    }
  }

  if (state === "error") {
    return <ErrorState title="로그 정보를 불러오지 못했습니다." description={error} onRetry={load} />;
  }

  const logs = analysis?.status === "COMPLETED" ? analysis.result?.logs : undefined;
  const analyzedAt = analysis?.completedAt ? Date.parse(analysis.completedAt) : 0;
  const hasNewFiles = files.some((f) => Date.parse(f.createdAt) > analyzedAt);
  const running = analysis?.status === "QUEUED" || analysis?.status === "ANALYZING";

  return (
    <div className="space-y-6">
      {agents === null ? <Skeleton className="h-48 rounded-2xl" /> : <LiveLogStream projectId={project.id} agents={agents} />}

      <div className="flex items-center gap-3 pt-2">
        <h2 className="text-[15px] font-bold text-ink-900">파일로 분석하기</h2>
        <span className="h-px flex-1 bg-line" />
      </div>

      {state === "ready" && files.length > 0 && (hasNewFiles || !logs?.available) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary-100 bg-primary-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] font-medium text-ink-700">
            분석에 반영되지 않은 로그 파일이 있습니다. 다시 분석하면 오류 패턴이 집계됩니다.
          </p>
          <Button onClick={analyze} loading={starting} disabled={running} className="shrink-0">
            {running ? "분석 진행중" : "로그 포함해 분석"}
          </Button>
        </div>
      )}

      {state === "loading" ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : logs?.available && logs.levels ? (
        <LogReport logs={logs} analyzedAt={analysis?.completedAt} />
      ) : (
        <Card>
          <CardBody className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <ScrollText size={24} strokeWidth={1.7} />
            </span>
            <p className="mt-4 text-[16px] font-bold text-ink-900">아직 분석된 로그가 없습니다</p>
            <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-500">
              애플리케이션 로그 파일을 올리고 분석을 실행하면 오류·경고 추이와 반복되는 오류, 자주 발생한 예외를 모아 보여줍니다.
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="로그 파일" description="LOG, TXT, JSON, CSV, GZ, ZIP 형식을 올릴 수 있습니다." />
        <CardBody className="space-y-4">
          {uploading && (
            <div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="truncate font-semibold text-ink-900">{uploading.name}</span>
                <span className="font-semibold tabular-nums text-primary-600">{uploading.percent}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-primary-500 transition-[width]" style={{ width: `${uploading.percent}%` }} />
              </div>
            </div>
          )}
          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                    <ScrollText size={17} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink-900">{f.originalFilename}</span>
                    <span className="mt-0.5 block text-[12px] tabular-nums text-ink-400">
                      {formatBytes(f.fileSize)} · {formatDateTime(f.createdAt)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(f)}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-ink-400 transition hover:bg-toss-red-soft hover:text-toss-red"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
          <FileDropzone
            icon={ScrollText}
            accept={UPLOAD_LIMITS.logAccept}
            multiple
            maxBytes={UPLOAD_LIMITS.logMaxBytes}
            title="로그 파일을 업로드하세요"
            description={`애플리케이션·서버 로그 · 최대 ${formatBytes(UPLOAD_LIMITS.logMaxBytes)}`}
            onFiles={upload}
          />
        </CardBody>
      </Card>

      <ConfirmDialog
        open={!!pendingDelete}
        title="로그 파일을 삭제할까요?"
        description={pendingDelete ? `${pendingDelete.originalFilename} 파일이 삭제됩니다.` : undefined}
        confirmLabel="삭제"
        danger
        onConfirm={async () => { if (pendingDelete) await remove(pendingDelete); }}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

function LogReport({ logs, analyzedAt }: { logs: LogStats; analyzedAt?: string | null }) {
  const lv = logs.levels!;
  const [open, setOpen] = useState<number | null>(null);
  const tiles = [
    { label: "치명", value: lv.FATAL, tone: "text-toss-red" },
    { label: "오류", value: lv.ERROR, tone: "text-toss-red" },
    { label: "경고", value: lv.WARN, tone: "text-toss-amber" },
    { label: "정보", value: lv.INFO, tone: "text-ink-500" },
  ];
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[15px] font-bold text-ink-900">로그 요약</p>
          <p className="text-[12px] tabular-nums text-ink-400">
            {logs.files}개 파일, {(logs.lines ?? 0).toLocaleString()}줄 · 분석 {formatDateTime(analyzedAt)}
          </p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl bg-toss-soft px-4 py-3">
              <dt className={cn("text-[12px] font-bold", t.tone)}>{t.label}</dt>
              <dd className="mt-1 text-[24px] font-extrabold leading-none tracking-tight text-ink-900 tabular-nums">
                {t.value.toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {(logs.timeline ?? []).length > 1 && <Timeline data={logs.timeline!} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader title="반복되는 오류" description="숫자·시간을 지우고 같은 메시지끼리 묶었습니다." />
          {(logs.topErrors ?? []).length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-ink-400">오류 로그가 없습니다.</p>
          ) : (
            <ul>
              {logs.topErrors!.map((e, i) => (
                <li key={`${e.message}-${i}`} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => setOpen(open === i ? null : i)}
                    aria-expanded={open === i}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-toss-soft"
                  >
                    <span className="w-14 shrink-0 text-right text-[14px] font-extrabold tabular-nums text-toss-red">
                      {e.count.toLocaleString()}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-700">{e.message}</span>
                    <ChevronDown size={15} className={cn("shrink-0 text-ink-300 transition-transform", open === i && "rotate-180")} />
                  </button>
                  {open === i && e.sample && (
                    <pre className="mx-5 mb-3 overflow-x-auto rounded-lg bg-ink-900 px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-100">
                      <code>{e.sample}</code>
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="자주 발생한 예외" />
          <CardBody>
            {(logs.exceptions ?? []).length === 0 ? (
              <p className="py-6 text-center text-[13px] text-ink-400">감지된 예외가 없습니다.</p>
            ) : (
              <ul className="space-y-2.5">
                {logs.exceptions!.map((x) => {
                  const max = logs.exceptions![0].count || 1;
                  return (
                    <li key={x.name}>
                      <div className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="truncate font-mono text-ink-800">{x.name}</span>
                        <span className="shrink-0 font-bold tabular-nums text-ink-900">{x.count.toLocaleString()}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                        <div className="h-full rounded-full" style={{ width: `${(x.count / max) * 100}%`, background: ERROR_COLOR }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Timeline({ data }: { data: NonNullable<LogStats["timeline"]> }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.error + d.warn));
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] font-bold text-ink-900">시간대별 오류·경고</p>
        <ul className="flex gap-4 text-[12px] text-ink-600">
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ERROR_COLOR }} />
            오류
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: WARN_COLOR }} />
            경고
          </li>
        </ul>
      </div>
      <div className="relative mt-5">
        <div className="flex h-40 items-end gap-[2px] border-b border-line">
          {data.map((d, i) => {
            const total = d.error + d.warn;
            return (
              <div
                key={d.bucket}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className="flex h-full flex-1 flex-col justify-end"
              >
                <div
                  className="flex w-full flex-col gap-[2px] overflow-hidden rounded-t-[4px] transition-opacity"
                  style={{ height: `${(total / max) * 100}%`, opacity: hover === null || hover === i ? 1 : 0.4 }}
                >
                  {d.warn > 0 && <div style={{ flex: d.warn, background: WARN_COLOR }} />}
                  {d.error > 0 && <div style={{ flex: d.error, background: ERROR_COLOR }} />}
                </div>
              </div>
            );
          })}
        </div>
        {hover !== null && (
          <div className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 -translate-y-full rounded-lg bg-ink-900 px-3 py-2 text-[12px] text-white shadow-lift">
            <span className="font-bold">{data[hover].bucket}</span>
            <span className="ml-2">오류 {data[hover].error}</span>
            <span className="ml-2">경고 {data[hover].warn}</span>
            <span className="ml-2 text-ink-300">전체 {data[hover].total}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between text-[11px] tabular-nums text-ink-400">
          <span>{data[0].bucket}</span>
          <span>{data[data.length - 1].bucket}</span>
        </div>
      </div>
    </Card>
  );
}
