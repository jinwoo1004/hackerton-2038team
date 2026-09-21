import type { PendingFile } from "@/shared/ui/FileDropzone";
import type { TechCategory } from "@/types";

export interface WizardState {
  name: string;
  nickname: string;
  projectCode: string;
  description: string;
  tech: Record<TechCategory, string[]>;
  ruleFiles: PendingFile[];
  sourceFile: PendingFile | null;
}

export const EMPTY_TECH: Record<TechCategory, string[]> = {
  LANGUAGE: [],
  FRAMEWORK: [],
  DATABASE: [],
  INFRASTRUCTURE: [],
};

export const initialWizardState: WizardState = {
  name: "",
  nickname: "",
  projectCode: "",
  description: "",
  tech: EMPTY_TECH,
  ruleFiles: [],
  sourceFile: null,
};

export const WIZARD_STEPS = [
  { id: 1, label: "기본정보" },
  { id: 2, label: "기술스택" },
  { id: 3, label: "프로젝트 규칙" },
  { id: 4, label: "프로젝트 파일" },
  { id: 5, label: "확인 및 저장" },
] as const;

export const STEP_COPY: Record<number, { title: string; description: string }> = {
  1: {
    title: "어떤 프로젝트를 분석할까요?",
    description: "프로젝트를 구분할 수 있는 이름과 코드를 입력해주세요.",
  },
  2: {
    title: "어떤 기술로 만들어진 프로젝트인가요?",
    description: "선택한 기술을 기준으로 소스와 로그를 해석합니다. 여러 개를 선택할 수 있습니다.",
  },
  3: {
    title: "프로젝트 규칙을 알려주세요.",
    description: "프로젝트의 구조와 개발 규칙을 함께 등록하면 향후 코드 및 로그 분석 정확도를 높일 수 있습니다.",
  },
  4: {
    title: "분석할 프로젝트 파일을 등록해주세요.",
    description: "소스 코드를 ZIP 으로 압축해 업로드하세요. 저장소 연동은 추후 지원됩니다.",
  },
  5: {
    title: "입력한 내용을 확인해주세요.",
    description: "프로젝트를 생성하면 등록한 파일이 함께 업로드됩니다.",
  },
};
