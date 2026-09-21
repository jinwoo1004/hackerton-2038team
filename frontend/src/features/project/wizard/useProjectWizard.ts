"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fileApi } from "@/services/fileApi";
import { projectApi } from "@/services/projectApi";
import { useToast } from "@/shared/ui/Toast";
import type { ProjectTechnology, TechCategory } from "@/types";
import type { CodeState } from "./StepBasic";
import { initialWizardState, WIZARD_STEPS, type WizardState } from "./types";

export type WizardErrors = Partial<Record<keyof WizardState, string>>;

export function useProjectWizard() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [state, setState] = useState<WizardState>(initialWizardState);
  const [errors, setErrors] = useState<WizardErrors>({});
  const [codeState, setCodeState] = useState<CodeState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [progressLabel, setProgressLabel] = useState("프로젝트를 준비하고 있습니다...");

  const patch = useCallback((next: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...next }));
    setErrors((prev) => {
      const cleared = { ...prev };
      for (const key of Object.keys(next) as (keyof WizardState)[]) delete cleared[key];
      return cleared;
    });
  }, []);

  const hasInput = useMemo(
    () =>
      Boolean(
        state.name ||
          state.nickname ||
          state.projectCode ||
          state.description ||
          state.ruleFiles.length ||
          state.sourceFile ||
          Object.values(state.tech).some((v) => v.length),
      ),
    [state],
  );

  function validateStep(target: number): boolean {
    const next: WizardErrors = {};
    if (target === 1) {
      if (!state.name.trim()) next.name = "프로젝트 이름을 입력해주세요.";
      if (!state.projectCode.trim()) next.projectCode = "프로젝트 코드를 입력해주세요.";
      else if (codeState === "taken") next.projectCode = "이미 사용 중인 프로젝트 코드입니다.";
      else if (codeState === "invalid") next.projectCode = "영문/숫자/-/_ 2~40자로 입력해주세요.";
    }
    if (target === 2 && Object.values(state.tech).every((v) => v.length === 0)) {
      next.tech = "최소 한 개 이상의 기술을 선택해주세요.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goTo(target: number) {
    setDirection(target < step ? "back" : "forward");
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goNext() {
    if (!validateStep(step)) return;
    goTo(Math.min(step + 1, WIZARD_STEPS.length));
  }

  function goPrev() {
    goTo(Math.max(step - 1, 1));
  }

  async function submit() {
    if (!validateStep(1) || !validateStep(2)) {
      goTo(1);
      return;
    }
    setSubmitting(true);
    setProgressLabel("프로젝트를 준비하고 있습니다...");
    try {
      const technologies: ProjectTechnology[] = (
        Object.entries(state.tech) as [TechCategory, string[]][]
      ).flatMap(([category, names]) => names.map((name) => ({ category, name })));

      const project = await projectApi.create({
        name: state.name.trim(),
        nickname: state.nickname.trim() || undefined,
        projectCode: state.projectCode.trim(),
        description: state.description.trim() || undefined,
        technologies,
      });

      // 파일은 프로젝트 생성 후 업로드
      const failed: string[] = [];
      const total = state.ruleFiles.length + (state.sourceFile ? 1 : 0);
      let done = 0;

      for (const rule of state.ruleFiles) {
        setProgressLabel(`규칙 문서를 업로드하고 있습니다... (${done + 1}/${total})`);
        try {
          await fileApi.upload(project.id, rule.file, "RULE");
        } catch {
          failed.push(rule.file.name);
        }
        done += 1;
      }

      if (state.sourceFile) {
        setProgressLabel(`프로젝트 파일을 업로드하고 있습니다... (${done + 1}/${total})`);
        try {
          await fileApi.upload(project.id, state.sourceFile.file, "SOURCE");
        } catch {
          failed.push(state.sourceFile.file.name);
        }
      }

      if (failed.length) {
        toast.error(`프로젝트는 생성되었지만 ${failed.length}개 파일 업로드에 실패했습니다.`);
      } else {
        toast.success("프로젝트가 등록되었습니다.");
      }
      router.replace(`/projects/${project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "프로젝트 생성에 실패했습니다.");
      setSubmitting(false);
    }
  }

  return {
    step,
    direction,
    state,
    errors,
    codeState,
    setCodeState,
    submitting,
    progressLabel,
    hasInput,
    isLast: step === WIZARD_STEPS.length,
    patch,
    goTo,
    goNext,
    goPrev,
    submit,
  };
}
