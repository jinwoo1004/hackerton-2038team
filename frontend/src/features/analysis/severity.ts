import { AlertOctagon, AlertTriangle, Info, type LucideIcon } from "lucide-react";
import type { FindingCategory, Severity } from "@/types";

export const SEVERITY: Record<Severity, { label: string; icon: LucideIcon; text: string; soft: string; dot: string }> = {
  CRITICAL: { label: "심각", icon: AlertOctagon, text: "text-toss-red", soft: "bg-toss-red-soft", dot: "bg-toss-red" },
  WARNING: { label: "주의", icon: AlertTriangle, text: "text-toss-amber", soft: "bg-toss-amber-soft", dot: "bg-toss-amber" },
  INFO: { label: "참고", icon: Info, text: "text-ink-500", soft: "bg-ink-100", dot: "bg-ink-400" },
};

export const CATEGORY_ORDER: FindingCategory[] = ["security", "errors", "quality", "performance", "rules", "logs"];

export const CATEGORY_TEXT: Record<FindingCategory, { label: string; description: string }> = {
  quality: { label: "코드 품질", description: "긴 파일·함수, 긴 줄, 남은 TODO" },
  errors: { label: "오류 위험", description: "예외 처리 누락, 디버그 출력" },
  security: { label: "보안 이슈", description: "비밀값 노출, SQL 조립, 위험한 호출" },
  performance: { label: "성능", description: "SELECT *, sleep, 동기 I/O" },
  rules: { label: "프로젝트 규칙", description: "규칙 문서에서 읽은 금지·기준 위반" },
  logs: { label: "로그", description: "반복되는 오류·치명 로그" },
};

export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"];
export const OTHER_COLOR = "#b4b2a9";
