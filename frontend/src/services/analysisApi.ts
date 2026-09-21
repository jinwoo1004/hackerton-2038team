import { USE_MOCK } from "@/shared/config/app";
import type { Analysis } from "@/types";
import { request } from "./http";
import { mockApi } from "./mock/store";

export const analysisApi = {
  start(projectId: number): Promise<Analysis> {
    if (USE_MOCK) return mockApi.startAnalysis(projectId);
    return request<Analysis>(`/api/projects/${projectId}/analysis`, { method: "POST" });
  },

  latest(projectId: number): Promise<Analysis | null> {
    if (USE_MOCK) return mockApi.latestAnalysis(projectId);
    return request<Analysis | null>(`/api/projects/${projectId}/analysis/latest`);
  },

  get(projectId: number, analysisId: number): Promise<Analysis> {
    if (USE_MOCK) return mockApi.analysis(projectId, analysisId);
    return request<Analysis>(`/api/projects/${projectId}/analysis/${analysisId}`);
  },

  history(projectId: number): Promise<Analysis[]> {
    if (USE_MOCK) return mockApi.analysisHistory(projectId);
    return request<Analysis[]>(`/api/projects/${projectId}/analysis/history`);
  },
};
