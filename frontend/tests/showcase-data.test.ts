import test from "node:test";
import assert from "node:assert/strict";
import { mockApi, type MockDb } from "../src/services/mock/store";
import { ensureShowcase, refreshShowcase, materializeShowcaseAnalysis, showcaseMetrics, showcaseHealth, SHOWCASE_PROJECTS, SHOWCASE_VERSION, MOCK_STORAGE_KEY, LEGACY_MOCK_STORAGE_KEY } from "../src/services/mock/showcaseData";

const NOW = Date.parse("2026-09-22T02:45:30Z");
const DAY = 86400_000;
function empty(): MockDb {
  return { seq: 1, users: [{ id: 1, email: "admin@xisnd.com", password: "test1234", name: "시연 관리자", role: "ADMIN", createdAt: new Date(NOW).toISOString() }], projects: [], files: [], analyses: [] };
}

test("first use creates seven distinct synthetic projects with 30-day histories and no duplicates", (t) => {
  const one = empty(), two = empty();
  const started = performance.now();
  assert.equal(ensureShowcase(one, 1, NOW), true);
  const elapsed = performance.now() - started;
  ensureShowcase(two, 1, NOW);
  assert.deepEqual(one, two);
  assert.equal(ensureShowcase(one, 1, NOW), false);
  assert.equal(one.projects.length, 7);
  assert.equal(one.analyses.length, 210);
  assert.equal(one.agents?.length, 11);
  assert.deepEqual(one.projects.map((p) => p.name), ["수목관리플랫폼", "워크허브", "작업중지권", "프리콘이행점검시스템", "현장안전관리시스템", "스마트검침시스템", "단지서버"]);
  assert.deepEqual(one.projects.map((p) => p.projectCode), ["TREE-CARE", "WORK-HUB", "STOP-WORK", "PRECON-CHECK", "SITE-SAFETY", "SMART-METER", "WALLPAD-DEMO"]);
  assert.ok(one.projects.every((p) => p.description?.includes("합성 시연")));
  assert.ok(one.projects.every((p) => p.description?.includes("실제 시스템 운영 상태")));
  assert.ok(one.events?.every((event) => event.projectName === one.projects.find((p) => p.id === event.projectId)?.name));
  for (const project of one.projects) {
    const history = one.analyses.filter((a) => a.projectId === project.id);
    assert.equal(history.length, 30);
    assert.ok(new Set(history.map((a) => a.score)).size >= 3);
    for (const analysis of [history[0], history[29]]) {
      const detail = materializeShowcaseAnalysis(one, analysis);
      assert.ok(detail.result?.findings.length);
      assert.equal(detail.result?.overview.score, analysis.score);
      assert.ok(detail.result?.findings.some((f) => f.ruleSource && f.file && f.line));
      assert.ok((detail.result?.logs.timeline?.length ?? 0) >= 24);
      assert.ok(detail.result?.notes[0].includes("합성 시연"));
    }
  }
  // Historical results are reconstructed rather than filling the browser's storage quota.
  const storedCharacters = JSON.stringify(one).length;
  assert.ok(storedCharacters < 1_000_000);
  t.diagnostic(`First gallery generation: ${elapsed.toFixed(0)} ms; storage: ${(storedCharacters * 2 / 1024 / 1024).toFixed(2)} MiB UTF-16 (${storedCharacters} characters).`);
});

test("all requested time ranges contain differentiated metrics and response times", () => {
  for (const minutes of [60, 360, 1440]) {
    const points = showcaseMetrics(0, 0, minutes, NOW);
    assert.ok(points.length >= 60);
    assert.equal(Date.parse(points.at(-1)!.time), NOW);
    assert.ok(Date.parse(points[0].time) <= NOW - (minutes - 1) * 60_000);
    assert.ok(new Set(points.map((p) => p.cpuPct)).size > 15);
    assert.ok(points.every((p) => p.responseMs > 0 && p.memoryPct! > 0 && p.diskPct! > 0));
    assert.notDeepEqual(points, showcaseMetrics(3, 1, minutes, NOW));
  }
});

test("health counts match incidents and history, and heartbeat stays fresh after a long absence", () => {
  const db = empty(); ensureShowcase(db, 1, NOW);
  const initial = showcaseHealth(db.projects, db.incidents ?? [], NOW);
  assert.deepEqual(initial.health, { total: 7, normal: 4, warning: 2, critical: 1, openIncidents: 3 });
  assert.equal(initial.incidentTrend.length, 7);
  assert.ok(initial.incidentTrend.reduce((total, day) => total + day.resolved, 0) > 20);
  const beforeIds = db.projects.map((p) => p.id);
  assert.equal(refreshShowcase(db, NOW + 45 * DAY), true);
  assert.deepEqual(db.projects.map((p) => p.id), beforeIds);
  assert.ok(db.agents?.every((a) => Math.abs(Date.parse(a.lastSeenAt!) - (NOW + 45 * DAY)) < 60_000));
  for (const project of db.projects) assert.equal(db.analyses.filter((a) => a.projectId === project.id).length, 30);
  assert.ok((db.logs ?? []).every((l) => l.message.includes("SYNTHETIC")));
  assert.ok((db.logs ?? []).some((l) => Date.parse(l.loggedAt) >= NOW + 45 * DAY - 60_000));
  assert.equal(refreshShowcase(db, NOW + 45 * DAY), false);
});

class MemoryStorage {
  entries = new Map<string, string>();
  getItem(key: string) { return this.entries.get(key) ?? null; }
  setItem(key: string, value: string) { this.entries.set(key, value); }
  removeItem(key: string) { this.entries.delete(key); }
}
async function browser(run: (storage: MemoryStorage) => Promise<void>) {
  const storage = new MemoryStorage();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalNow = Date.now;
  Object.defineProperty(globalThis, "window", { value: { localStorage: storage }, configurable: true });
  Date.now = () => NOW;
  storage.setItem("mp.token", "mock-1");
  try { await run(storage); }
  finally { Date.now = originalNow; if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window"); }
}

test("browser migration preserves legacy records and keeps the previous key recoverable", async () => browser(async (storage) => {
  const db = empty();
  db.seq = 40;
  db.projects.push({ id: 10, projectCode: "USER-WORK", name: "내 프로젝트", description: "사용자가 만든 원본", status: "READY", technologies: [], fileCount: 0, createdBy: 1, createdAt: new Date(NOW - DAY).toISOString(), updatedAt: new Date(NOW - DAY).toISOString() });
  const legacy = JSON.stringify(db);
  storage.setItem(LEGACY_MOCK_STORAGE_KEY, legacy);
  const projects = await mockApi.listProjects();
  assert.equal(projects.length, 8);
  assert.equal(projects.find((p) => p.id === 10)?.description, "사용자가 만든 원본");
  assert.equal(storage.getItem(LEGACY_MOCK_STORAGE_KEY), legacy);
  assert.ok(storage.getItem(MOCK_STORAGE_KEY));
  assert.deepEqual((await mockApi.listProjects()).map((p) => p.id), projects.map((p) => p.id));
  await mockApi.resetDemo();
  assert.equal((await mockApi.listProjects()).length, 8);
  assert.equal((await mockApi.getProject(10)).name, "내 프로젝트");
}));

test("persisted catalog labels migrate in place without resetting histories, incidents, or user records", async () => browser(async (storage) => {
  const db = empty(); ensureShowcase(db, 1, NOW);
  const previous = [
    ["GAEPO-XI", "개포 프레지던스 자이", "gaepo-gateway", "월패드 · 방문 예약"],
    ["BUKSUWON-XI", "북수원 자이 렉스비아", "buksuwon-api", "공동현관 · 홈네트워크"],
    ["SONGDO-DEMO", "송도 센트럴 단지", "songdo-parking", "주차 관제 · 차량 출입"],
    ["GWACHEON-DEMO", "과천 포레스트 단지", "gwacheon-community", "커뮤니티 · 시설 예약"],
    ["MAPO-DEMO", "마포 리버뷰 단지", "mapo-energy", "원격 검침 · 에너지"],
    ["DONGTAN-DEMO", "동탄 레이크 단지", "dongtan-access", "출입 인증 · 모바일 연동"],
    ["WALLPAD-DEMO", "월패드 안전 시연", "wallpad-demo-01", "응답 지연 · 오류 급증 실습"],
  ];
  let legacyJson = JSON.stringify(db);
  for (let i = 0; i < SHOWCASE_PROJECTS.length; i++) {
    const spec = SHOWCASE_PROJECTS[i], old = previous[i];
    for (const [before, after] of [[spec.host, old[2]], [spec.name, old[1]], [spec.service, old[3]], [spec.code, old[0]], [spec.code.toLowerCase(), old[0].toLowerCase()]]) legacyJson = legacyJson.split(before).join(after);
  }
  const legacy = JSON.parse(legacyJson) as MockDb;
  legacy.showcase!.version = 2;
  const complexServerId = legacy.projects[6].id;
  const complexServerEvent = legacy.events?.find((event) => event.projectId === complexServerId);
  if (complexServerEvent) complexServerEvent.message = "월패드 연동 응답 지연 감지";
  const manual = { ...legacy.projects[0], id: ++legacy.seq, projectCode: "MY-SYSTEM", name: "개포 프레지던스 자이", nickname: "직접 등록", description: "gaepo-gateway 사용자가 작성한 원문" };
  legacy.projects.push(manual);
  const colliding = { ...legacy.projects[0], id: ++legacy.seq, projectCode: "tree-care", name: "사용자 수목 프로젝트", nickname: "직접 등록", description: "사용자가 만든 프로젝트" };
  legacy.projects.push(colliding);
  const uploaded = { id: ++legacy.seq, projectId: legacy.projects[0].id, fileType: "LOG" as const, originalFilename: "사용자-gaepo-original.log", fileSize: 123, mimeType: "text/plain", createdAt: new Date(NOW).toISOString() };
  legacy.files.push(uploaded);
  const ids = legacy.projects.map((p) => p.id);
  const analyses = legacy.analyses.map((a) => [a.id, a.createdAt, a.score, a.status]);
  const incidents = legacy.incidents!.map((i) => [i.id, i.openedAt, i.resolvedAt, i.status]);
  const health = showcaseHealth(legacy.projects, legacy.incidents!, NOW);
  storage.setItem(MOCK_STORAGE_KEY, JSON.stringify(legacy));
  const projects = await mockApi.listProjects();
  const migrated = JSON.parse(storage.getItem(MOCK_STORAGE_KEY)!) as MockDb;
  assert.equal(migrated.showcase!.version, SHOWCASE_VERSION);
  assert.deepEqual(projects.map((p) => p.id).sort((a, b) => a - b), ids.sort((a, b) => a - b));
  assert.deepEqual(migrated.projects.slice(0, 7).map((p) => p.name), SHOWCASE_PROJECTS.map((p) => p.name));
  assert.deepEqual(migrated.analyses.map((a) => [a.id, a.createdAt, a.score, a.status]), analyses);
  assert.deepEqual(migrated.incidents!.map((i) => [i.id, i.openedAt, i.resolvedAt, i.status]), incidents);
  assert.deepEqual(showcaseHealth(migrated.projects, migrated.incidents!, NOW), health);
  assert.deepEqual(migrated.projects.find((p) => p.id === manual.id), manual);
  assert.deepEqual(migrated.files.find((f) => f.id === uploaded.id), uploaded);
  assert.equal(migrated.agents?.length, 11);
  assert.ok(migrated.events?.every((e) => e.projectName === migrated.projects.find((p) => p.id === e.projectId)?.name));
  assert.ok(migrated.events?.every((e) => !(e.message ?? "").includes("월패드 연동")));
  assert.ok(migrated.incidents?.every((i) => i.projectName === migrated.projects.find((p) => p.id === i.projectId)?.name && i.agentName === migrated.agents?.find((a) => a.id === i.agentId)?.name));
  assert.equal(migrated.projects.filter((p) => p.projectCode.toUpperCase() === "TREE-CARE").length, 1);
  assert.equal(migrated.projects.find((p) => p.id === colliding.id)?.projectCode, "tree-care");
  assert.equal((await mockApi.listProjects()).length, 9);
  const seed = await mockApi.seedDemo();
  assert.equal((await mockApi.getProject(seed.projectId)).name, "단지서버");
  const triggered = await mockApi.triggerDemo(seed.projectId, "LATENCY");
  assert.equal(triggered.insight?.serverName, "complex-server-01");
  assert.match((await mockApi.incidentPreview(triggered.id)).message, /단지서버/);
  await mockApi.recoverDemo(seed.projectId);
}));

test("trigger, recovery, reset and analysis remain usable without a backend or seeded-file fetch", async () => browser(async () => {
  const seed = await mockApi.seedDemo();
  assert.deepEqual(await mockApi.seedDemo(), seed);
  assert.ok((await mockApi.analysis(seed.projectId, seed.analysisId)).result?.findings.length);
  const history = await mockApi.analysisHistory(seed.projectId);
  const oldest = history[history.length - 1];
  assert.equal((await mockApi.analysis(seed.projectId, oldest.id)).result?.overview.score, oldest.score);
  const initial = await mockApi.monitoringOverview();
  const incident = await mockApi.triggerDemo(seed.projectId, "LATENCY");
  assert.equal((await mockApi.triggerDemo(seed.projectId, "LATENCY")).id, incident.id);
  const triggered = await mockApi.dashboard();
  assert.equal(triggered.health?.critical, initial.health!.critical + 1);
  assert.equal((await mockApi.incidentPreview(incident.id)).externalDelivery, false);
  assert.match((await mockApi.incidentPreview(incident.id)).message, /3200/);
  const metrics = await mockApi.metrics(seed.projectId, 60);
  assert.equal((metrics.series[0].points.at(-1) as { responseMs: number }).responseMs, 3200);
  await mockApi.recoverDemo(seed.projectId);
  assert.deepEqual((await mockApi.monitoringOverview()).health, initial.health);
  assert.ok((await mockApi.metrics(seed.projectId, 60)).series.length);
  const analysis = await mockApi.startAnalysis(seed.projectId);
  assert.ok(analysis.result?.findings.length);
  await mockApi.resetDemo(); await mockApi.resetDemo();
  const projects = await mockApi.listProjects();
  assert.equal(projects.length, SHOWCASE_PROJECTS.length);
  assert.equal(new Set(projects.map((p) => p.projectCode)).size, projects.length);
  const resetSeed = await mockApi.seedDemo();
  assert.ok((await mockApi.latestAnalysis(resetSeed.projectId))?.result?.findings.length);
}));

test("legacy synthetic agents get fresh heartbeat and full metric ranges without replacing their project", async () => browser(async (storage) => {
  const db = empty();
  db.seq = 40;
  const old = new Date(NOW - 45 * DAY).toISOString();
  db.projects.push({ id: 10, projectCode: "WALLPAD-DEMO", name: "이전 시연 원본", description: "보존할 프로젝트", status: "ACTIVE", technologies: [], fileCount: 0, createdBy: 1, createdAt: old, updatedAt: old });
  db.agents = [{ id: 40, projectId: 10, name: "이전 합성 에이전트", tokenPrefix: "demo-public", state: "ONLINE", createdAt: old, lastSeenAt: old }];
  db.demoAnchors = { 10: old };
  storage.setItem(LEGACY_MOCK_STORAGE_KEY, JSON.stringify(db));
  const agent = (await mockApi.agents(10))[0];
  assert.equal(agent.lastSeenAt, new Date(NOW).toISOString());
  assert.ok(agent.latest?.responseMs);
  assert.equal((await mockApi.metrics(10, 1440)).series[0].points.length, 289);
  assert.ok((await mockApi.logEntries(10)).some((entry) => entry.source === "synthetic-live.log"));
  await mockApi.resetDemo();
  assert.equal((await mockApi.getProject(10)).name, "이전 시연 원본");
}));

test("new accounts own separate galleries and cannot read or mutate another user's projects", async () => browser(async (storage) => {
  const adminProjects = await mockApi.listProjects();
  const user = await mockApi.signup({ email: "synthetic-user@xisnd.com", password: "public-test-password", name: "새 사용자" });
  storage.setItem("mp.token", user.token);
  const own = await mockApi.listProjects();
  assert.equal(own.length, 7);
  assert.ok(own.every((p) => p.createdBy === user.user.id && !adminProjects.some((admin) => admin.id === p.id)));
  await assert.rejects(mockApi.getProject(adminProjects[0].id), /찾을 수 없습니다/);
  await assert.rejects(mockApi.incidents({ projectId: adminProjects[0].id }), /찾을 수 없습니다/);
  await assert.rejects(mockApi.deleteProject(adminProjects[0].id), /찾을 수 없습니다/);
  await mockApi.resetDemo();
  storage.setItem("mp.token", "mock-1");
  assert.deepEqual((await mockApi.listProjects()).map((p) => p.id), adminProjects.map((p) => p.id));
}));

test("deleting an authored gallery project persists across reads and fresh renders", async () => browser(async () => {
  const first = await mockApi.listProjects();
  await mockApi.deleteProject(first[0].id);
  assert.equal((await mockApi.listProjects()).length, 6);
  assert.equal((await mockApi.listProjects()).some((p) => p.id === first[0].id), false);
}));
