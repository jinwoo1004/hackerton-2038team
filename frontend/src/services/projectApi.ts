import { USE_MOCK } from "@/shared/config/app";
import type { CodeCheckResponse, Project, ProjectCreateRequest, ProjectUpdateRequest } from "@/types";
import { request } from "./http";
import { mockApi } from "./mock/store";

export const projectApi = {
  list(): Promise<Project[]> {
    if (USE_MOCK) return mockApi.listProjects();
    return request<Project[]>("/api/projects");
  },

  get(projectId: number): Promise<Project> {
    if (USE_MOCK) return mockApi.getProject(projectId);
    return request<Project>(`/api/projects/${projectId}`);
  },

  create(body: ProjectCreateRequest): Promise<Project> {
    if (USE_MOCK) return mockApi.createProject(body);
    return request<Project>("/api/projects", { method: "POST", json: body });
  },

  update(projectId: number, body: ProjectUpdateRequest): Promise<Project> {
    if (USE_MOCK) return mockApi.updateProject(projectId, body);
    return request<Project>(`/api/projects/${projectId}`, { method: "PUT", json: body });
  },

  remove(projectId: number): Promise<void> {
    if (USE_MOCK) return mockApi.deleteProject(projectId);
    return request<void>(`/api/projects/${projectId}`, { method: "DELETE" });
  },

  async checkCode(code: string): Promise<boolean> {
    if (USE_MOCK) return mockApi.checkCode(code);
    const res = await request<CodeCheckResponse>(
      `/api/projects/check-code?code=${encodeURIComponent(code)}`,
    );
    return res.available;
  },
};

// MON-20260827-A81F 형식
export function generateProjectCode(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `MON-${stamp}-${rand}`;
}
