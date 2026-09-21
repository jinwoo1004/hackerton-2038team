"use client";

import { FileArchive, FileText, Info } from "lucide-react";
import { UPLOAD_LIMITS } from "@/shared/config/app";
import { formatBytes } from "@/shared/lib/format";
import { FileDropzone, FileItem, type PendingFile } from "@/shared/ui/FileDropzone";
import type { WizardState } from "./types";

function toPending(file: File): PendingFile {
  return { key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`, file };
}

export function StepRules({
  value,
  onChange,
}: {
  value: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-4">
      <FileDropzone
        icon={FileText}
        accept={UPLOAD_LIMITS.ruleAccept}
        multiple
        maxBytes={UPLOAD_LIMITS.ruleMaxBytes}
        title="규칙 문서를 업로드하세요"
        description={`PDF, Word, Markdown, Excel · 최대 ${formatBytes(UPLOAD_LIMITS.ruleMaxBytes)}`}
        onFiles={(files) => onChange({ ruleFiles: [...value.ruleFiles, ...files.map(toPending)] })}
      />

      {value.ruleFiles.length > 0 && (
        <div className="space-y-2">
          {value.ruleFiles.map((f) => (
            <FileItem
              key={f.key}
              name={f.file.name}
              size={f.file.size}
              onRemove={() => onChange({ ruleFiles: value.ruleFiles.filter((x) => x.key !== f.key) })}
            />
          ))}
        </div>
      )}

      <Notice>규칙 문서는 선택 사항입니다. 나중에 프로젝트 파일 탭에서 추가할 수 있습니다.</Notice>
    </div>
  );
}

export function StepSource({
  value,
  onChange,
}: {
  value: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-4">
      {value.sourceFile ? (
        <FileItem
          archive
          name={value.sourceFile.file.name}
          size={value.sourceFile.file.size}
          onRemove={() => onChange({ sourceFile: null })}
        />
      ) : (
        <FileDropzone
          icon={FileArchive}
          accept={UPLOAD_LIMITS.sourceAccept}
          maxBytes={UPLOAD_LIMITS.sourceMaxBytes}
          title="프로젝트 소스를 업로드하세요"
          description={`ZIP 파일 · 최대 ${formatBytes(UPLOAD_LIMITS.sourceMaxBytes)}`}
          onFiles={(files) => onChange({ sourceFile: toPending(files[0]) })}
        />
      )}

      <Notice>
        GitHub · GitLab · SVN · 로컬 Agent 연동은 다음 단계에서 지원됩니다. 지금은 ZIP 업로드만 가능합니다.
      </Notice>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-toss-soft px-4 py-3">
      <Info size={16} className="mt-0.5 shrink-0 text-ink-400" />
      <p className="text-[13px] leading-relaxed text-ink-500">{children}</p>
    </div>
  );
}
