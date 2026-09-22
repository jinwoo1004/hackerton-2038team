import assert from "node:assert/strict";
import test from "node:test";

test("showcase browsing, incidents, and raw HTTP helpers never contact a backend", async () => {
  process.env.NEXT_PUBLIC_DATA_MODE = "mock";
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://retired-backend.example.invalid";
  const storage = new Map<string, string>();
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) },
    dispatchEvent: () => true,
  } });
  globalThis.fetch = async () => { calls++; throw new Error("Network disabled in showcase test"); };
  try {
    const { API_BASE_URL, USE_MOCK } = await import("../src/shared/config/app");
    const { authApi } = await import("../src/services/authApi");
    const { projectApi } = await import("../src/services/projectApi");
    const { dashboardApi } = await import("../src/services/dashboardApi");
    const { agentApi, telemetryApi } = await import("../src/services/agentApi");
    const { demoApi } = await import("../src/services/demoApi");
    const { request, upload, setToken } = await import("../src/services/http");
    assert.equal(USE_MOCK, true);
    assert.equal(API_BASE_URL, "");
    const auth = await authApi.login({ email: "admin@xisnd.com", password: "test1234" });
    setToken(auth.token);
    const projects = await projectApi.list();
    assert.ok(projects.length >= 6);
    assert.ok((await dashboardApi.dashboard()).projects.total >= 6);
    assert.ok((await telemetryApi.overview()).agentsOnline > 0);
    assert.ok((await telemetryApi.metrics(projects[0].id)).series.length > 0);
    const seed = await demoApi.seed();
    const incident = await demoApi.trigger(seed.projectId, "LATENCY");
    assert.equal((await demoApi.preview(incident.id)).externalDelivery, false);
    await demoApi.recover(seed.projectId);
    await assert.rejects(request("/api/projects"), /서버 요청/);
    await assert.rejects(upload("/api/files", new FormData()), /브라우저/);
    await assert.rejects(agentApi.downloadInstaller("demo.exe"), /설치가 필요하지/);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});
