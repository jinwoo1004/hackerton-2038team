"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { TECH_GROUPS } from "@/features/project/techOptions";
import { Input } from "@/shared/ui/Input";
import type { TechCategory } from "@/types";
import type { WizardState } from "./types";

export function StepTech({
  value,
  onChange,
  error,
}: {
  value: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  error?: string;
}) {
  function setCategory(category: TechCategory, next: string[]) {
    onChange({ tech: { ...value.tech, [category]: next } });
  }

  return (
    <div className="space-y-8">
      {error && (
        <p role="alert" className="rounded-lg bg-toss-red-soft px-3.5 py-2.5 text-[13px] font-medium text-toss-red">
          {error}
        </p>
      )}

      {TECH_GROUPS.map((group) => {
        const selected = value.tech[group.category];
        const custom = selected.filter((s) => !group.options.includes(s));
        return (
          <section key={group.category}>
            <div className="mb-3">
              <h3 className="text-[15px] font-bold text-ink-900">
                {group.label}
                {selected.length > 0 && (
                  <span className="ml-2 text-[13px] font-semibold text-primary-600">{selected.length}개 선택</span>
                )}
              </h3>
              <p className="mt-0.5 text-[13px] text-ink-400">{group.description}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => (
                <TechChip
                  key={option}
                  label={option}
                  selected={selected.includes(option)}
                  onClick={() =>
                    setCategory(
                      group.category,
                      selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option],
                    )
                  }
                />
              ))}
              {custom.map((name) => (
                <TechChip
                  key={name}
                  label={name}
                  selected
                  removable
                  onClick={() => setCategory(group.category, selected.filter((v) => v !== name))}
                />
              ))}
              <CustomTechInput
                onAdd={(name) => {
                  if (!selected.includes(name)) setCategory(group.category, [...selected, name]);
                }}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TechChip({
  label,
  selected,
  removable = false,
  onClick,
}: {
  label: string;
  selected: boolean;
  removable?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={
        selected
          ? "inline-flex h-10 items-center gap-1.5 rounded-lg border border-primary-500 bg-primary-50 px-3.5 text-[13px] font-semibold text-primary-700 transition"
          : "inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 text-[13px] font-semibold text-ink-600 transition hover:border-ink-300 hover:bg-ink-100"
      }
    >
      {label}
      {selected && removable && <X size={13} strokeWidth={3} className="text-primary-500" />}
      {selected && !removable && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" aria-hidden>
          <path d="M4 12.5 9.5 18 20 6.5" />
        </svg>
      )}
    </button>
  );
}

function CustomTechInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  function commit() {
    const name = text.trim();
    if (name) onAdd(name);
    setText("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-dashed border-line bg-white px-3.5 text-[13px] font-semibold text-ink-400 transition hover:border-primary-300 hover:text-primary-600"
      >
        <Plus size={14} strokeWidth={2.5} />
        직접 입력
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Input
        autoFocus
        value={text}
        placeholder="기술 이름"
        className="h-10 w-40"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setText("");
            setOpen(false);
          }
        }}
        onBlur={commit}
      />
    </span>
  );
}
