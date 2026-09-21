"use client";

import { StepBasic } from "./StepBasic";
import { StepConfirm } from "./StepConfirm";
import { StepRules, StepSource } from "./StepFiles";
import { StepTech } from "./StepTech";
import type { useProjectWizard } from "./useProjectWizard";

export function WizardStepBody({ wizard }: { wizard: ReturnType<typeof useProjectWizard> }) {
  const { step, state, patch, errors, codeState, setCodeState, goTo } = wizard;
  return (
    <>
      {step === 1 && (
        <StepBasic
          value={state}
          onChange={patch}
          errors={errors}
          codeState={codeState}
          onCodeStateChange={setCodeState}
        />
      )}
      {step === 2 && <StepTech value={state} onChange={patch} error={errors.tech} />}
      {step === 3 && <StepRules value={state} onChange={patch} />}
      {step === 4 && <StepSource value={state} onChange={patch} />}
      {step === 5 && <StepConfirm value={state} onEdit={goTo} />}
    </>
  );
}
