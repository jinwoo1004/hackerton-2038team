"use client";

import { useCallback, useRef, useState } from "react";
import { FileArchive, FileText, Trash2, Upload, type LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { formatBytes } from "@/shared/lib/format";
import { Button } from "./Button";

export interface PendingFile {
  key: string;
  file: File;
  progress?: number;
  error?: string;
}

export function FileDropzone({
  accept,
  multiple = false,
  maxBytes,
  title,
  description,
  icon: Icon = Upload,
  onFiles,
  disabled,
  className,
}: {
  accept: readonly string[];
  multiple?: boolean;
  maxBytes?: number;
  title: string;
  description: string;
  icon?: LucideIcon;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(
    (files: File[]) => {
      const ok: File[] = [];
      for (const f of files) {
        const ext = `.${f.name.split(".").pop()?.toLowerCase() ?? ""}`;
        if (!accept.includes(ext)) {
          setError(`${f.name} — 지원하지 않는 형식입니다. (${accept.join(", ")})`);
          continue;
        }
        if (maxBytes && f.size > maxBytes) {
          setError(`${f.name} — 최대 ${formatBytes(maxBytes)}까지 업로드할 수 있습니다.`);
          continue;
        }
        ok.push(f);
      }
      if (ok.length) setError(null);
      return ok;
    },
    [accept, maxBytes],
  );

  function handleFiles(list: FileList | null) {
    if (!list || disabled) return;
    const picked = validate(Array.from(list));
    if (picked.length) onFiles(multiple ? picked : picked.slice(0, 1));
  }

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-primary-500 bg-primary-50" : "border-line bg-toss-soft/60 hover:border-primary-300 hover:bg-primary-50/40",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-white shadow-soft transition-colors",
            dragging ? "text-primary-600" : "text-ink-400",
          )}
        >
          <Icon size={22} strokeWidth={1.7} />
        </div>
        <p className="mt-4 text-sm font-bold text-ink-900">{title}</p>
        <p className="mt-1 text-[13px] text-ink-400">{description}</p>
        <Button type="button" variant="secondary" size="sm" className="mt-4 pointer-events-none">
          파일 선택
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept.join(",")}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

export function FileItem({
  name,
  size,
  progress,
  error,
  onRemove,
  archive = false,
}: {
  name: string;
  size: number;
  progress?: number;
  error?: string;
  onRemove?: () => void;
  archive?: boolean;
}) {
  const uploading = typeof progress === "number" && progress < 100;
  const Icon = archive ? FileArchive : FileText;
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            error ? "bg-toss-red-soft text-toss-red" : "bg-primary-50 text-primary-600",
          )}
        >
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink-900">{name}</p>
          <p className={cn("mt-0.5 text-xs", error ? "text-danger" : "text-ink-400")}>
            {error ?? (uploading ? `업로드 중 ${progress}%` : formatBytes(size))}
          </p>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${name} 삭제`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-400 transition hover:bg-toss-red-soft hover:text-toss-red"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      {uploading && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full rounded-full bg-primary-500 transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
