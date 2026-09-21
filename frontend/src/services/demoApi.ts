import { USE_MOCK } from "@/shared/config/app";
import type { DemoSeed, Incident, SlackPreview } from "@/types";
import { request } from "./http";
import { mockApi } from "./mock/store";
import type { DemoScenario } from "./mock/demoData";

export const DATA_CHANGED = "mp:data-changed";
export function notifyDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DATA_CHANGED));
    window.localStorage.setItem("mp.data-version", String(Date.now()));
  }
}

export const demoApi = {
  async reset(): Promise<void> {
    if (!USE_MOCK) throw new Error("전체 스택 초기화는 demo.ps1 Reset을 사용해주세요.");
    await mockApi.resetDemo();
    notifyDataChanged();
  },
  async seed(): Promise<DemoSeed> {
    const result = USE_MOCK ? await mockApi.seedDemo() : await request<DemoSeed>("/api/demo/seed", { method: "POST" });
    notifyDataChanged();
    return result;
  },
  async trigger(projectId: number, scenario: DemoScenario): Promise<Incident> {
    const result = USE_MOCK ? await mockApi.triggerDemo(projectId, scenario) : await request<Incident>(`/api/demo/projects/${projectId}/trigger`, { method: "POST", json: { scenario } });
    notifyDataChanged();
    return result;
  },
  async recover(projectId: number): Promise<void> {
    if (USE_MOCK) await mockApi.recoverDemo(projectId);
    else await request(`/api/demo/projects/${projectId}/recover`, { method: "POST" });
    notifyDataChanged();
  },
  preview(id: number): Promise<SlackPreview> {
    return USE_MOCK ? mockApi.incidentPreview(id) : request<SlackPreview>(`/api/incidents/${id}/preview`);
  },
};
