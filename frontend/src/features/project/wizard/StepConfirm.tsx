"use client";

import { FileArchive, FileText } from "lucide-react";
import { CATEGORY_LABEL, TECH_GROUPS } from "@/features/project/techOptions";
import { formatBytes } from "@/shared/lib/format";
import { Chip } from "@/shared/ui/Badge";
import type { WizardState } from "./types";

export function StepConfirm({ value, onEdit }: { value: WizardState; onEdit: (step: number) => void }) {
  return (
    <div className="space-y-6">
      <Section title="프로젝트" onEdit={() => onEdit(1)}>
        <div className="space-y-3">
          <div>
            <p className="text-[17px] font-bold text-ink-900">{value.name}</p>
            {value.nickname && <p className="mt-0.5 text-[13px] text-ink-500">{value.nickname}</p>}
          </div>
          <Row label="Project Code">
            <span className="font-mono text-[13px] font-semibold text-ink-900">{value.projectCode}</span>
          </Row>
          {value.description && (
            <Row label="설명">
              <span className="text-[13px] leading-relaxed text-ink-700">{value.description}</span>
            </Row>
          )}
        </div>
      </Section>

      <Section title="기술 스택" onEdit={() => onEdit(2)}>
        <div className="space-y-3">
          {TECH_GROUPS.map((g) => {
            const items = value.tech[g.category];
            if (!items.length) return null;
            return (
              <Row key={g.category} label={CATEGORY_LABEL[g.category]}>
                <span className="flex flex-wrap gap-1.5">
                  {items.map((name) => (
                    <Chip key={name}>{name}</Chip>
                  ))}
                </span>
              </Row>
            );
          })}
          {Object.values(value.tech).every((v) => v.length === 0) && (
            <p className="text-[13px] text-ink-400">선택된 기술이 없습니다.</p>
          )}
        </div>
      </Section>

      <Section title="프로젝트 규칙" onEdit={() => onEdit(3)}>
        {value.ruleFiles.length ? (
          <ul className="space-y-2">
            {value.ruleFiles.map((f) => (
              <FileRow key={f.key} name={f.file.name} size={f.file.size} />
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-400">등록된 규칙 문서가 없습니다.</p>
        )}
      </Section>

      <Section title="프로젝트 파일" onEdit={() => onEdit(4)}>
        {value.sourceFile ? (
          <ul>
            <FileRow archive name={value.sourceFile.file.name} size={value.sourceFile.file.size} />
          </ul>
        ) : (
          <p className="text-[13px] text-ink-400">등록된 소스 파일이 없습니다.</p>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h3 className="text-[14px] font-bold text-ink-900">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md px-2 py-1 text-[13px] font-semibold text-primary-600 transition hover:bg-primary-50"
        >
          수정
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
      <span className="shrink-0 text-[13px] font-semibold text-ink-400 sm:w-32">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function FileRow({ name, size, archive = false }: { name: string; size: number; archive?: boolean }) {
  const Icon = archive ? FileArchive : FileText;
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <Icon size={16} className="shrink-0 text-ink-400" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-900">{name}</span>
      <span className="shrink-0 text-[12px] tabular-nums text-ink-400">{formatBytes(size)}</span>
    </li>
  );
}
