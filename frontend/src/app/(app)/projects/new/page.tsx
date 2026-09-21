"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { STEP_COPY, WIZARD_STEPS } from "@/features/project/wizard/types";
import { useProjectWizard } from "@/features/project/wizard/useProjectWizard";
import { WizardStepBody } from "@/features/project/wizard/WizardStepBody";
import { Button } from "@/shared/ui/Button";
import { BlockingOverlay } from "@/shared/ui/Loading";
import { Stepper } from "@/shared/ui/Stepper";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

export default function NewProjectPage() {
  const router = useRouter();
  const wizard = useProjectWizard();
  const { step, submitting, progressLabel, hasInput, isLast, goTo, goNext, goPrev, submit } = wizard;
  const [leaveOpen, setLeaveOpen] = useState(false);

  const copy = STEP_COPY[step];

  return (
    <>
      {submitting && (
        <BlockingOverlay
          title={progressLabel}
          description="잠시만 기다려주세요. 완료되면 프로젝트 화면으로 이동합니다."
        />
      )}

      <div className="mx-auto max-w-3xl pb-24 sm:pb-0">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold text-ink-900 sm:text-2xl">새 프로젝트 만들기</h1>
            <p className="mt-1 text-sm text-ink-500">5단계면 분석 준비가 끝납니다.</p>
          </div>
          <button
            type="button"
            onClick={() => (hasInput ? setLeaveOpen(true) : router.push("/projects"))}
            aria-label="만들기 취소"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-100 hover:text-ink-900"
          >
            <X size={20} />
          </button>
        </div>

        <Stepper
          steps={WIZARD_STEPS.map((s) => ({ id: s.id, label: s.label }))}
          current={step}
          onStepClick={goTo}
          className="mb-7"
        />

        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-7">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-ink-900">{copy.title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{copy.description}</p>
          </div>
          <WizardStepBody wizard={wizard} />
        </div>

        <div className="mt-6 hidden items-center justify-between sm:flex">
          <Button variant="secondary" onClick={goPrev} disabled={step === 1}>
            <ArrowLeft size={16} />
            이전
          </Button>
          {isLast ? (
            <Button size="lg" onClick={submit} loading={submitting}>
              프로젝트 생성
            </Button>
          ) : (
            <Button onClick={goNext}>
              다음
              <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 backdrop-blur sm:hidden">
        <Button variant="secondary" size="lg" onClick={goPrev} disabled={step === 1} className="flex-1">
          이전
        </Button>
        {isLast ? (
          <Button size="lg" onClick={submit} loading={submitting} className="flex-[2]">
            프로젝트 생성
          </Button>
        ) : (
          <Button size="lg" onClick={goNext} className="flex-[2]">
            다음
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={leaveOpen}
        title="프로젝트 만들기를 그만둘까요?"
        description="입력한 내용은 저장되지 않습니다."
        confirmLabel="그만두기"
        cancelLabel="계속 작성"
        danger
        onConfirm={() => router.push("/projects")}
        onClose={() => setLeaveOpen(false)}
      />
    </>
  );
}
