"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ChevronLeft, Play, X } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { DashboardPreview } from "@/features/project/onboarding/DashboardPreview";
import { TECH_GROUPS } from "@/features/project/techOptions";
import { STEP_COPY, WIZARD_STEPS } from "@/features/project/wizard/types";
import { useProjectWizard } from "@/features/project/wizard/useProjectWizard";
import { WizardStepBody } from "@/features/project/wizard/WizardStepBody";
import { cn } from "@/shared/lib/cn";
import { BlockingOverlay } from "@/shared/ui/Loading";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { TeamBrand } from "@/shared/ui/TeamBrand";
import { useToast } from "@/shared/ui/Toast";
import type { TechCategory } from "@/types";

const techCount = (category: TechCategory) =>
  TECH_GROUPS.find((g) => g.category === category)?.options.length ?? 0;

const STATS = [
  { value: `${techCount("LANGUAGE")}개`, label: "분석 가능 언어" },
  { value: `${techCount("FRAMEWORK")}개`, label: "지원 프레임워크" },
  { value: "60%", label: "운영 비용 절감 효과" },
];

function delay(ms: number) {
  return { animationDelay: `${ms}ms` };
}

export function FirstProjectOnboarding() {
  const [phase, setPhase] = useState<"intro" | "wizard">("intro");
  const [session, setSession] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const scrollTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return createPortal(
    <div
      ref={scrollRef}
      className={cn("fixed inset-0 z-[80] overflow-y-auto", phase === "intro" ? "bg-[#FBFCFE]" : "bg-white")}
    >
      {phase === "intro" && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -right-[10%] -top-[20%] h-[900px] w-[1100px] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.2),rgba(59,130,246,0))] blur-2xl" />
          <div className="absolute -bottom-[30%] left-[30%] h-[700px] w-[900px] rounded-full bg-[radial-gradient(closest-side,rgba(147,197,253,0.18),rgba(147,197,253,0))] blur-2xl" />
          <div className="grid-texture absolute inset-0 opacity-40 [mask-image:radial-gradient(60%_55%_at_50%_40%,#000_20%,transparent_75%)]" />
        </div>
      )}

      <div className="relative flex min-h-full items-center justify-center px-5 py-12 sm:px-8 sm:py-16">
        {phase === "intro" ? (
          <Intro onStart={() => setPhase("wizard")} />
        ) : (
          <OnboardingWizard
            key={session}
            onStepChange={scrollTop}
            onExit={() => {
              setPhase("intro");
              setSession((s) => s + 1);
            }}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  const { user, logout } = useAuth();
  const toast = useToast();

  return (
    <>
      <div
        style={delay(200)}
        className="animate-rise-in absolute left-5 right-5 top-5 flex items-start justify-between gap-4 sm:left-8 sm:right-8 sm:top-6"
      >
        <TeamBrand />
        <p className="shrink-0 pt-2 text-[12px] text-toss-sub">
          <span className="hidden sm:inline">{user?.email}</span>
          <span className="mx-2 hidden text-toss-line sm:inline">|</span>
          <button type="button" onClick={logout} className="font-semibold text-toss-mid underline-offset-2 hover:underline">
            로그아웃
          </button>
        </p>
      </div>

      <section className="mx-auto grid w-full max-w-[1360px] items-center gap-16 pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14 lg:pt-6 xl:gap-20">
        <div className="text-center lg:text-left">
          <h1
            style={delay(120)}
            className="animate-rise-in text-[36px] font-extrabold leading-[1.2] tracking-[-0.045em] text-toss-ink sm:text-[50px] xl:text-[58px]"
          >
            첫 프로젝트를 등록하고
            <br />
            <span className="text-primary-600">분석을 시작해볼까요?</span>
          </h1>


          <p
            style={delay(340)}
            className="animate-rise-in mt-6 text-[16px] font-medium leading-[1.75] text-toss-mid sm:text-[18px]"
          >
            프로젝트 정보와 소스만 알려주시면
            <br />
            프로젝트 관리는{" "}
            <span
              style={delay(1100)}
              className="animate-highlight bg-[linear-gradient(transparent_38%,rgba(255,214,51,0.72)_38%,rgba(255,214,51,0.72)_96%,transparent_96%)] bg-no-repeat px-0.5 font-bold text-toss-ink [box-decoration-break:clone]"
            >
              저희가 할게요
            </span>
            .
          </p>

          <div
            style={delay(580)}
            className="animate-rise-in mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
          >
            <button
              type="button"
              onClick={onStart}
              className="group inline-flex h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 px-9 text-[17px] font-bold text-white shadow-[0_14px_32px_-10px_rgba(37,99,235,0.6)] transition hover:bg-primary-700 active:scale-[0.98] sm:w-auto"
            >
              프로젝트 등록 시작하기
              <ArrowRight size={19} strokeWidth={2.5} className="transition-transform group-hover:translate-x-1" />
            </button>
            <button
              type="button"
              onClick={() => toast.show("소개 영상은 준비 중이에요.")}
              className="inline-flex h-[60px] w-full items-center justify-center gap-2.5 rounded-2xl border border-toss-line bg-white px-8 text-[16px] font-bold text-toss-ink transition hover:bg-toss-soft active:scale-[0.98] sm:w-auto"
            >
              <Play size={15} fill="currentColor" strokeWidth={0} />
              1분 소개 영상 보기
            </button>
          </div>
          <p style={delay(680)} className="animate-rise-in mt-4 text-[13px] text-toss-sub">
            3분이면 충분해요. 규칙 문서와 소스는 나중에 올려도 괜찮아요.
          </p>

          <dl
            style={delay(800)}
            className="animate-rise-in mt-12 flex justify-center divide-x divide-toss-line lg:justify-start"
          >
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col-reverse px-5 first:pl-0 last:pr-0 sm:px-8">
                <dt className="mt-1 text-[12px] text-toss-sub sm:text-[13px]">{s.label}</dt>
                <dd className="text-[22px] font-extrabold tracking-tight text-toss-ink sm:text-[26px]">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div style={delay(500)} className="animate-rise-in hidden pb-20 lg:block">
          <DashboardPreview userName={user?.name} />
        </div>
      </section>
    </>
  );
}

function OnboardingWizard({ onExit, onStepChange }: { onExit: () => void; onStepChange: () => void }) {
  const wizard = useProjectWizard();
  const { step, direction, submitting, progressLabel, hasInput, isLast, goNext, goPrev, submit } = wizard;
  const [leaveOpen, setLeaveOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const copy = STEP_COPY[step];
  const total = WIZARD_STEPS.length;
  const label = WIZARD_STEPS[step - 1].label;

  useEffect(() => {
    onStepChange();
  }, [step, onStepChange]);

  useEffect(() => {
    if (step !== 1) return;
    const t = setTimeout(() => bodyRef.current?.querySelector("input")?.focus({ preventScroll: true }), 350);
    return () => clearTimeout(t);
  }, [step]);

  const leave = () => (hasInput ? setLeaveOpen(true) : onExit());
  const back = () => (step === 1 ? leave() : goPrev());

  const primary = (
    <button
      type="button"
      onClick={isLast ? submit : goNext}
      disabled={submitting}
      className="inline-flex h-14 flex-[2] items-center justify-center gap-1.5 rounded-2xl bg-primary-600 text-[17px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,0.6)] transition hover:bg-primary-700 active:scale-[0.98] disabled:opacity-60"
    >
      {isLast ? "프로젝트 등록하기" : "다음"}
    </button>
  );
  const secondary = step > 1 && (
    <button
      type="button"
      onClick={goPrev}
      className="inline-flex h-14 flex-1 items-center justify-center rounded-2xl bg-toss-line2 text-[16px] font-bold text-toss-mid transition hover:bg-toss-line active:scale-[0.98]"
    >
      이전
    </button>
  );

  return (
    <>
      {submitting && (
        <BlockingOverlay
          title={progressLabel}
          description="잠시만 기다려주세요. 완료되면 프로젝트 화면으로 이동합니다."
        />
      )}

      <section className="mx-auto w-full max-w-[680px] animate-rise-in pb-24 sm:pb-0">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={back}
            aria-label={step === 1 ? "처음 화면으로" : "이전 단계"}
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-xl text-toss-mid transition hover:bg-toss-line2"
          >
            <ChevronLeft size={24} />
          </button>
          <p className="text-[14px] font-semibold tabular-nums text-toss-sub">
            <span className="text-primary-600">{step}</span> / {total}
          </p>
          <button
            type="button"
            onClick={leave}
            aria-label="등록 그만두기"
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-xl text-toss-sub transition hover:bg-toss-line2 hover:text-toss-mid"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-toss-line2">
          <div
            className="h-full rounded-full bg-primary-600 transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: `${(step / total) * 100}%` }}
          />
        </div>

        <div
          key={step}
          ref={bodyRef}
          className={direction === "forward" ? "animate-step-in-right" : "animate-step-in-left"}
        >
          <p className="mt-10 text-[15px] font-bold text-primary-600">{label}</p>
          <h2 className="mt-2 text-[28px] font-extrabold leading-[1.3] tracking-[-0.035em] text-toss-ink sm:text-[34px]">
            {copy.title}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-toss-mid sm:text-[16px]">{copy.description}</p>

          <div className="mt-8 rounded-3xl border border-toss-line2 bg-white p-5 shadow-card sm:p-7">
            <WizardStepBody wizard={wizard} />
          </div>
        </div>

        <div className="mt-8 hidden gap-3 sm:flex">
          {secondary}
          {primary}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 bg-gradient-to-t from-white via-white to-white/0 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-6 sm:hidden">
        {secondary}
        {primary}
      </div>

      <ConfirmDialog
        open={leaveOpen}
        title="프로젝트 등록을 그만둘까요?"
        description="입력한 내용은 저장되지 않습니다."
        confirmLabel="그만두기"
        cancelLabel="계속 작성"
        danger
        onConfirm={() => {
          setLeaveOpen(false);
          onExit();
        }}
        onClose={() => setLeaveOpen(false)}
      />
    </>
  );
}
