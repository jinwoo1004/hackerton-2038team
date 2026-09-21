import { USE_MOCK } from "@/shared/config/app";
import type {
  AlertChannel,
  AlertChannelRequest,
  AlertDelivery,
  AlertRule,
  AlertRuleRequest,
  Incident,
  IncidentStatus,
} from "@/types";
import { request } from "./http";
import { mockApi } from "./mock/store";

export const incidentApi = {
  list(params: { projectId?: number; status?: IncidentStatus; limit?: number } = {}): Promise<Incident[]> {
    if (USE_MOCK) return mockApi.incidents(params);
    const q = new URLSearchParams();
    if (params.projectId) q.set("projectId", String(params.projectId));
    if (params.status) q.set("status", params.status);
    q.set("limit", String(params.limit ?? 50));
    return request<Incident[]>(`/api/incidents?${q.toString()}`);
  },

  resolve(id: number): Promise<Incident> {
    if (USE_MOCK) return mockApi.resolveIncident(id);
    return request<Incident>(`/api/incidents/${id}/resolve`, { method: "POST" });
  },
};

export interface TestResult {
  success: boolean;
  error?: string | null;
}

export const alertApi = {
  channels(): Promise<AlertChannel[]> {
    if (USE_MOCK) return mockApi.alertChannels();
    return request<AlertChannel[]>("/api/alerts/channels");
  },

  createChannel(body: AlertChannelRequest): Promise<AlertChannel> {
    if (USE_MOCK) return mockApi.saveAlertChannel(null, body);
    return request<AlertChannel>("/api/alerts/channels", { method: "POST", json: body });
  },

  updateChannel(id: number, body: AlertChannelRequest): Promise<AlertChannel> {
    if (USE_MOCK) return mockApi.saveAlertChannel(id, body);
    return request<AlertChannel>(`/api/alerts/channels/${id}`, { method: "PUT", json: body });
  },

  removeChannel(id: number): Promise<void> {
    if (USE_MOCK) return mockApi.deleteAlertChannel(id);
    return request<void>(`/api/alerts/channels/${id}`, { method: "DELETE" });
  },

  test(id: number): Promise<TestResult> {
    if (USE_MOCK) return mockApi.testAlertChannel();
    return request<TestResult>(`/api/alerts/channels/${id}/test`, { method: "POST" });
  },

  rules(): Promise<AlertRule[]> {
    if (USE_MOCK) return mockApi.alertRules();
    return request<AlertRule[]>("/api/alerts/rules");
  },

  createRule(body: AlertRuleRequest): Promise<AlertRule> {
    if (USE_MOCK) return mockApi.saveAlertRule(null, body);
    return request<AlertRule>("/api/alerts/rules", { method: "POST", json: body });
  },

  updateRule(id: number, body: AlertRuleRequest): Promise<AlertRule> {
    if (USE_MOCK) return mockApi.saveAlertRule(id, body);
    return request<AlertRule>(`/api/alerts/rules/${id}`, { method: "PUT", json: body });
  },

  removeRule(id: number): Promise<void> {
    if (USE_MOCK) return mockApi.deleteAlertRule(id);
    return request<void>(`/api/alerts/rules/${id}`, { method: "DELETE" });
  },

  deliveries(limit = 30): Promise<AlertDelivery[]> {
    if (USE_MOCK) return mockApi.alertDeliveries();
    return request<AlertDelivery[]>(`/api/alerts/deliveries?limit=${limit}`);
  },
};
