"use client";

import { useCallback, useEffect, useState } from "react";
import { FileArchive, FileText, FolderOpen } from "lucide-react";
import { fileApi } from "@/services/fileApi";
import { useProject } from "@/features/project/ProjectContext";
import { UPLOAD_LIMITS } from "@/shared/config/app";
import { formatBytes, formatDateTime } from "@/shared/lib/format";
import { Card, CardBody, CardHeader } from "@/shared/ui/Card";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ErrorState } from "@/shared/ui/EmptyState";
import { FileDropzone } from "@/shared/ui/FileDropzone";
import { Skeleton } from "@/shared/ui/Skeleton";
import { useToast } from "@/shared/ui/Toast";
import type { ProjectFile, ProjectFileType } from "@/types";

type LoadState = "loading" | "ready" | "error";

interface Uploading {
  id: string;
  name: string;
  size: number;
  percent: number;
}

export default function ProjectFilesPage() {
  const { project, patch } = useProject();
  const toast = useToast();

  const [state, setState] = useState<LoadState>("loading");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [pendingDelete, setPendingDelete] = useState<ProjectFile | null>(null);

  const projectId = project?.id;

  const load = useCallback(() => {
    if (!projectId) return;
    setState("loading");
    fileApi
      .list(projectId)
      .then((list) => {
        setFiles(list);
        setState("ready");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "파일을 불러오지 못했습니다.");
        setState("error");
      });
  }, [projectId]);

  useEffect(load, [load]);

  if (!project) return null;

  async function handleUpload(picked: File[], fileType: ProjectFileType) {
    if (!projectId) return;
    for (const file of picked) {
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setUploading((prev) => [...prev, { id, name: file.name, size: file.size, percent: 0 }]);
      try {
        const saved = await fileApi.upload(projectId, file, fileType, (percent) =>
          setUploading((prev) => prev.map((u) => (u.id === id ? { ...u, percent } : u))),
        );
        setFiles((prev) => [...prev, saved]);
        patch({ fileCount: project.fileCount + 1 });
        toast.success(`${file.name} 업로드 완료`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `${file.name} 업로드에 실패했습니다.`);
      } finally {
        setUploading((prev) => prev.filter((u) => u.id !== id));
      }
    }
  }

  async function handleDelete(file: ProjectFile) {
    if (!projectId) return;
    try {
      await fileApi.remove(projectId, file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      patch({ fileCount: Math.max(0, project.fileCount - 1) });
      toast.success("파일을 삭제했습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "파일을 삭제하지 못했습니다.");
    }
  }

  const rules = files.filter((f) => f.fileType === "RULE");
  const sources = files.filter((f) => f.fileType === "SOURCE");
  const others = files.filter((f) => f.fileType !== "RULE" && f.fileType !== "SOURCE");

  if (state === "error") {
    return <ErrorState title="파일을 불러오지 못했습니다." description={error} onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      {uploading.length > 0 && (
        <Card>
          <CardHeader title="업로드 중" description={`${uploading.length}개 파일`} />
          <CardBody className="space-y-3">
            {uploading.map((u) => (
              <div key={u.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[13px] font-semibold text-ink-900">{u.name}</span>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-primary-600">
                    {u.percent}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-primary-500 transition-[width] duration-200"
                    style={{ width: `${u.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <FileSection
        title="프로젝트 규칙"
        description="구조·개발 규칙 문서를 등록하면 분석 정확도가 올라갑니다."
        icon={FileText}
        files={rules}
        loading={state === "loading"}
        emptyText="등록된 규칙 문서가 없습니다."
        onDelete={setPendingDelete}
        dropzone={
          <FileDropzone
            icon={FileText}
            accept={UPLOAD_LIMITS.ruleAccept}
            multiple
            maxBytes={UPLOAD_LIMITS.ruleMaxBytes}
            title="규칙 문서를 업로드하세요"
            description={`PDF, Word, Markdown, Excel · 최대 ${formatBytes(UPLOAD_LIMITS.ruleMaxBytes)}`}
            onFiles={(picked) => handleUpload(picked, "RULE")}
          />
        }
      />

      <FileSection
        title="프로젝트 파일"
        description="분석 대상 소스를 ZIP 으로 등록합니다."
        icon={FileArchive}
        files={sources}
        loading={state === "loading"}
        emptyText="등록된 소스 파일이 없습니다."
        onDelete={setPendingDelete}
        dropzone={
          <FileDropzone
            icon={FileArchive}
            accept={UPLOAD_LIMITS.sourceAccept}
            maxBytes={UPLOAD_LIMITS.sourceMaxBytes}
            title="프로젝트 소스를 업로드하세요"
            description={`ZIP 파일 · 최대 ${formatBytes(UPLOAD_LIMITS.sourceMaxBytes)}`}
            onFiles={(picked) => handleUpload(picked, "SOURCE")}
          />
        }
      />

      {others.length > 0 && (
        <FileSection
          title="기타 파일"
          description="로그 등 그 밖에 등록된 파일입니다."
          icon={FolderOpen}
          files={others}
          loading={false}
          emptyText="등록된 파일이 없습니다."
          onDelete={setPendingDelete}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="파일을 삭제할까요?"
        description={pendingDelete ? `${pendingDelete.originalFilename} 파일이 삭제됩니다.` : undefined}
        confirmLabel="삭제"
        danger
        onConfirm={async () => { if (pendingDelete) await handleDelete(pendingDelete); }}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

function FileSection({
  title,
  description,
  icon: Icon,
  files,
  loading,
  emptyText,
  dropzone,
  onDelete,
}: {
  title: string;
  description: string;
  icon: typeof FileText;
  files: ProjectFile[];
  loading: boolean;
  emptyText: string;
  dropzone?: React.ReactNode;
  onDelete: (file: ProjectFile) => void;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="space-y-4">
        {loading ? (
          <>
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </>
        ) : files.length ? (
          <ul className="space-y-2">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                  <Icon size={17} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink-900">
                    {f.originalFilename}
                  </span>
                  <span className="mt-0.5 block text-[12px] tabular-nums text-ink-400">
                    {formatBytes(f.fileSize)} · {formatDateTime(f.createdAt)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(f)}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-ink-400 transition hover:bg-toss-red-soft hover:text-toss-red"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-2 text-[13px] text-ink-400">{emptyText}</p>
        )}
        {dropzone}
      </CardBody>
    </Card>
  );
}
