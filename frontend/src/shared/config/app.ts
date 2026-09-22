import { resolveDataMode } from "./dataMode.mjs";

export const APP = {
  name: "Monitoring Platform",
  nameKo: "모니터링 플랫폼",
  shortName: "Monitoring",
  tagline: "프로젝트 코드부터 운영 로그까지 하나의 흐름으로.",
  description:
    "프로젝트의 소스와 운영 로그를 한곳에 모아 분석하고, 시스템 상태를 통합 모니터링합니다.",
} as const;

export const COMPANY = {
  name: "XI S&D",
  team: "2038 해커톤 TEAM",
  copyright: "© XI S&D, All Rights Reserved. Designed & Developed by 2038 해커톤 TEAM.",
} as const;

export const EMAIL_DOMAINS = ["xisnd.com"] as const;

// A showcase never contacts a backend, even if an old deployment still has its URL.
export const DATA_MODE = resolveDataMode(process.env.NEXT_PUBLIC_DATA_MODE);
export const USE_MOCK = DATA_MODE === "mock";
export const API_BASE_URL = USE_MOCK ? "" : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

export const UPLOAD_LIMITS = {
  ruleMaxBytes: 20 * 1024 * 1024,
  sourceMaxBytes: 500 * 1024 * 1024,
  ruleAccept: [".pdf", ".md", ".txt", ".doc", ".docx", ".xlsx", ".xls", ".csv"],
  sourceAccept: [".zip"],
  logMaxBytes: 200 * 1024 * 1024,
  logAccept: [".log", ".txt", ".out", ".json", ".csv", ".gz", ".zip"],
} as const;
