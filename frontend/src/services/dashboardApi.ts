import { USE_MOCK } from "@/shared/config/app";
import type { AnalysisListItem, Dashboard, EventLevel, EventPage, EventSummary, SystemStatus } from "@/types";
import { request } from "./http";
import { mockApi } from "./mock/store";

export const dashboardApi = {
  dashboard(): Promise<Dashboard> {
    if (USE_MOCK) return mockApi.dashboard();
    return request<Dashboard>("/api/dashboard");
  },

  analyses(limit = 100): Promise<AnalysisListItem[]> {
    if (USE_MOCK) return mockApi.allAnalyses();
    return request<AnalysisListItem[]>(`/api/analyses?limit=${limit}`);
  },

  systemStatus(): Promise<SystemStatus> {
    if (USE_MOCK) return mockApi.systemStatus();
    return request<SystemStatus>("/api/system/status");
  },
};

export interface EventQuery {
  projectId?: number;
  level?: EventLevel;
  days?: number;
  q?: string;
  sort?: "asc" | "desc";
  page?: number;
  size?: number;
}

function eventParams(params: EventQuery) {
  const q = new URLSearchParams();
  if (params.projectId) q.set("projectId", String(params.projectId));
  if (params.level) q.set("level", params.level);
  if (params.days) q.set("days", String(params.days));
  if (params.q?.trim()) q.set("q", params.q.trim());
  return q;
}

export const eventApi = {
  search(params: EventQuery = {}): Promise<EventPage> {
    if (USE_MOCK) return mockApi.events(params);
    const q = eventParams(params);
    if (params.sort) q.set("sort", params.sort);
    q.set("page", String(params.page ?? 0));
    q.set("size", String(params.size ?? 30));
    return request<EventPage>(`/api/events?${q.toString()}`);
  },

  summary(params: Pick<EventQuery, "projectId" | "days" | "q"> = {}): Promise<EventSummary> {
    if (USE_MOCK) return mockApi.eventSummary(params);
    return request<EventSummary>(`/api/events/summary?${eventParams(params).toString()}`);
  },
};
