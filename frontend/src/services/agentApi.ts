import { API_BASE_URL, USE_MOCK } from "@/shared/config/app";
import type { Agent, AgentCreated, LogEntry, MetricSeriesResponse, MonitoringOverview } from "@/types";
import { ApiError, getToken, request } from "./http";
import { mockApi } from "./mock/store";

export interface InstallerInfo {
  available: boolean;
  fileName?: string | null;
  sizeBytes?: number | null;
  updatedAt?: string | null;
}

export const agentApi = {
  list(projectId: number): Promise<Agent[]> {
    if (USE_MOCK) return mockApi.agents(projectId);
    return request<Agent[]>(`/api/projects/${projectId}/agents`);
  },

  create(projectId: number, name: string): Promise<AgentCreated> {
    if (USE_MOCK) return mockApi.createAgent(projectId, name);
    return request<AgentCreated>(`/api/projects/${projectId}/agents`, { method: "POST", json: { name } });
  },

  remove(projectId: number, agentId: number): Promise<void> {
    if (USE_MOCK) return mockApi.deleteAgent(projectId, agentId);
    return request<void>(`/api/projects/${projectId}/agents/${agentId}`, { method: "DELETE" });
  },

  installer(): Promise<InstallerInfo> {
    if (USE_MOCK) return Promise.resolve({ available: false });
    return request<InstallerInfo>("/api/agent-installer");
  },

  async downloadInstaller(fileName: string): Promise<void> {
    if (USE_MOCK) throw new ApiError("데모에서는 에이전트 설치가 필요하지 않습니다.", 0);
    const res = await fetch(`${API_BASE_URL}/api/agent-installer/download`, {
      headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    });
    if (!res.ok) throw new ApiError("설치 파일을 받지 못했습니다.", res.status);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export interface LogQuery {
  agentId?: number;
  level?: "ALL" | "WARN" | "ERROR";
  q?: string;
  afterId?: number;
  limit?: number;
}

export const telemetryApi = {
  logs(projectId: number, query: LogQuery = {}): Promise<LogEntry[]> {
    if (USE_MOCK) return mockApi.logEntries(projectId, query);
    const q = new URLSearchParams();
    if (query.agentId) q.set("agentId", String(query.agentId));
    if (query.level && query.level !== "ALL") q.set("level", query.level);
    if (query.q?.trim()) q.set("q", query.q.trim());
    if (query.afterId) q.set("afterId", String(query.afterId));
    q.set("limit", String(query.limit ?? 200));
    return request<LogEntry[]>(`/api/projects/${projectId}/log-entries?${q.toString()}`);
  },

  metrics(projectId: number, minutes = 60, agentId?: number): Promise<MetricSeriesResponse> {
    if (USE_MOCK) return mockApi.metrics(projectId, minutes, agentId);
    const q = new URLSearchParams({ minutes: String(minutes) });
    if (agentId) q.set("agentId", String(agentId));
    return request<MetricSeriesResponse>(`/api/projects/${projectId}/metrics?${q.toString()}`);
  },

  overview(): Promise<MonitoringOverview> {
    if (USE_MOCK) return mockApi.monitoringOverview();
    return request<MonitoringOverview>("/api/monitoring/overview");
  },
};
