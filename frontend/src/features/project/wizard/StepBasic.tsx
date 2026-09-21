"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { generateProjectCode, projectApi } from "@/services/projectApi";
import { cn } from "@/shared/lib/cn";
import { Field, Input, Textarea } from "@/shared/ui/Input";
import type { WizardState } from "./types";

export type CodeState = "idle" | "checking" | "available" | "taken" | "invalid";

const CODE_RE = /^[A-Za-z0-9_-]{2,40}$/;

export function StepBasic({
  value,
  onChange,
  errors,
  codeState,
  onCodeStateChange,
}: {
  value: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  errors: Partial<Record<keyof WizardState, string>>;
  codeState: CodeState;
  onCodeStateChange: (state: CodeState) => void;
}) {
  const [touchedCode, setTouchedCode] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const code = value.projectCode.trim();
    if (!code) {
      onCodeStateChange("idle");
      return;
    }
    if (!CODE_RE.test(code)) {
      onCodeStateChange("invalid");
      return;
    }
    onCodeStateChange("checking");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      projectApi
        .checkCode(code)
        .then((available) => onCodeStateChange(available ? "available" : "taken"))
        .catch(() => onCodeStateChange("idle"));
    }, 450);
    return () => clearTimeout(timer.current);
  }, [value.projectCode, onCodeStateChange]);

  const codeMessage: Record<CodeState, { text: string; tone: string } | null> = {
    idle: null,
    checking: { text: "중복 확인 중...", tone: "text-ink-400" },
    available: { text: "사용할 수 있는 코드입니다.", tone: "text-toss-green" },
    taken: { text: "이미 사용 중인 코드입니다.", tone: "text-danger" },
    invalid: { text: "영문/숫자/-/_ 2~40자로 입력해주세요.", tone: "text-danger" },
  };
  const msg = touchedCode || value.projectCode ? codeMessage[codeState] : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="프로젝트 이름" required error={errors.name} hint="예) TREECS">
          <Input
            value={value.name}
            invalid={!!errors.name}
            placeholder="프로젝트 이름을 입력하세요"
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </Field>
        <Field label="프로젝트 닉네임" hint="예) 수목 관리 플랫폼">
          <Input
            value={value.nickname}
            placeholder="사람이 알아보기 쉬운 이름"
            onChange={(e) => onChange({ nickname: e.target.value })}
          />
        </Field>
      </div>

      <Field
        label="프로젝트 코드"
        required
        error={errors.projectCode}
        hint="시스템 내부에서 프로젝트를 구분하는 고유 값입니다."
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={value.projectCode}
              invalid={!!errors.projectCode || codeState === "taken" || codeState === "invalid"}
              placeholder="TREECS"
              className="pr-10 font-mono uppercase"
              onBlur={() => setTouchedCode(true)}
              onChange={(e) => onChange({ projectCode: e.target.value.toUpperCase() })}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {codeState === "checking" && <Loader2 size={16} className="animate-spin text-ink-300" />}
              {codeState === "available" && <Check size={16} className="text-toss-green" strokeWidth={3} />}
              {(codeState === "taken" || codeState === "invalid") && <X size={16} className="text-danger" strokeWidth={3} />}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onChange({ projectCode: generateProjectCode() })}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 text-[13px] font-semibold text-ink-700 transition hover:bg-ink-100"
          >
            <RefreshCw size={14} className="text-ink-400" />
            자동 생성
          </button>
        </div>
      </Field>
      {msg && <p className={cn("-mt-3 text-xs font-medium", msg.tone)}>{msg.text}</p>}

      <Field label="프로젝트 설명" hint="어떤 시스템인지 한두 문장으로 적어주세요.">
        <Textarea
          value={value.description}
          placeholder="예) 수목 데이터와 도면을 관리하는 사내 플랫폼"
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </Field>
    </div>
  );
}
