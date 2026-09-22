import type { Agent, Analysis, AnalysisResult, HealthSummary, Incident, IncidentInsight, IncidentTrend, LogEntry, MetricBucket, Project } from "@/types";
import { analyzeUploads } from "./analyzer";
import { DEMO_CODE, localInsight } from "./demoData";
import type { ParsedUpload } from "./documentParser";
import type { MockDb } from "./store";

export const SHOWCASE_VERSION = 3;
// Keep the persisted schema key stable; catalog migrations preserve existing IDs and user data.
export const MOCK_STORAGE_KEY = "mp.mockdb.showcase.v1";
export const LEGACY_MOCK_STORAGE_KEY = "mp.mockdb";
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export const SHOWCASE_PROJECTS = [
  { code: "TREE-CARE", name: "수목관리플랫폼", host: "tree-care-api", service: "수목 자산 · 점검 이력", cpu: 38, memory: 52, disk: 41, response: 135, agents: 2, issue: null },
  { code: "WORK-HUB", name: "워크허브", host: "workhub-api", service: "협업 공간 · 업무 요청", cpu: 59, memory: 69, disk: 58, response: 240, agents: 2, issue: "LATENCY" },
  { code: "STOP-WORK", name: "작업중지권", host: "stop-work-api", service: "위험 신고 · 작업 중지 요청", cpu: 31, memory: 44, disk: 36, response: 105, agents: 1, issue: null },
  { code: "PRECON-CHECK", name: "프리콘이행점검시스템", host: "precon-check-api", service: "사전 시공 점검 · 이행 현황", cpu: 47, memory: 67, disk: 73, response: 180, agents: 2, issue: "MEMORY_HIGH" },
  { code: "SITE-SAFETY", name: "현장안전관리시스템", host: "site-safety-api", service: "안전 점검 · 위험 요인 추적", cpu: 24, memory: 39, disk: 32, response: 92, agents: 1, issue: null },
  { code: "SMART-METER", name: "스마트검침시스템", host: "smart-meter-api", service: "원격 검침 · 에너지 사용량", cpu: 42, memory: 58, disk: 65, response: 155, agents: 2, issue: "DISK_HIGH" },
  { code: DEMO_CODE, name: "단지서버", host: "complex-server", service: "월패드 연동 · 응답 지연 및 오류 감지", cpu: 33, memory: 57, disk: 44, response: 120, agents: 1, issue: null },
] as const;

// Previous labels are retained only to migrate authored showcase records in existing browsers.
const PREVIOUS_LABELS = [
  ["GAEPO-XI", "개포 프레지던스 자이", "gaepo-gateway", "월패드 · 방문 예약"],
  ["BUKSUWON-XI", "북수원 자이 렉스비아", "buksuwon-api", "공동현관 · 홈네트워크"],
  ["SONGDO-DEMO", "송도 센트럴 단지", "songdo-parking", "주차 관제 · 차량 출입"],
  ["GWACHEON-DEMO", "과천 포레스트 단지", "gwacheon-community", "커뮤니티 · 시설 예약"],
  ["MAPO-DEMO", "마포 리버뷰 단지", "mapo-energy", "원격 검침 · 에너지"],
  ["DONGTAN-DEMO", "동탄 레이크 단지", "dongtan-access", "출입 인증 · 모바일 연동"],
  [DEMO_CODE, "월패드 안전 시연", "wallpad-demo-01", "응답 지연 · 오류 급증 실습"],
] as const;

export interface ShowcaseState {
  version: number;
  owners: Record<number, { projectIds: number[]; initializedAt: string }>;
  projects: Record<number, { profile: number; seededAt: string; latestSyntheticAnalysisId: number }>;
  agents: Record<number, { profile: number; ordinal: number; lastTick: string }>;
  files: Record<number, ParsedUpload>;
  analyses: Record<number, { profile: number; daysAgo: number; at: number }>;
}

const iso = (time: number) => new Date(time).toISOString();
const id = (db: MockDb) => ++db.seq;
const minuteFloor = (time: number) => Math.floor(time / MINUTE) * MINUTE;
const round = (value: number) => Math.round(value * 10) / 10;

/** These inputs are authored for this public showcase, never copied from operational logs or source. */
export function showcaseInputs(profile: number, daysAgo = 0, instant = Date.now()): ParsedUpload[] {
  const spec = SHOWCASE_PROJECTS[profile];
  const regression = Math.floor(daysAgo / 6);
  const diagnostics = 1 + (profile % 3) + regression + ((Math.floor(instant / DAY) + profile) % 3 === 0 ? 1 : 0);
  const sourceEntries = [
    { path: "src/gateway/RequestGateway.ts", text: [
      "// SYNTHETIC SHOWCASE: sample code only, never connected to a production service.",
      `export function ${profile % 3 === 1 ? "dispatch_request" : "dispatchRequest"}(payload: string) {`,
      "  const request = JSON.parse(payload);",
      ...Array.from({ length: diagnostics }, (_, i) => `  console.log('SYNTHETIC diagnostic stage ${i + 1}', request.kind);`),
      ...(profile === 1 || regression >= 3 ? ["  const result = eval('2 + 2');"] : ["  const result = Number(request.value ?? 0);"]),
      "  return { status: 'accepted', result };", "}", "",
      ...Array.from({ length: 5 + profile }, (_, i) => [
        `export function mapChannel${i + 1}(value: number) {`,
        `  const channel = 'synthetic-channel-${i + 1}';`,
        `  const normalized = Math.max(0, value * ${i + 1});`,
        "  return { channel, normalized, source: 'SYNTHETIC' };", "}", "",
      ]).flat(),
    ].join("\n") },
    { path: "src/health/HealthReport.java", text: [
      "// SYNTHETIC SHOWCASE: demonstration source.",
      "public class HealthReport {",
      "  public String buildReport() {",
      "    String status = \"synthetic-ready\";",
      ...(profile === 3 || regression >= 2 ? ["    System.out.println(status);"] : []),
      "    return status;", "  }", "}",
    ].join("\n") },
    { path: "agent/CollectionPolicy.cs", text: [
      "// SYNTHETIC SHOWCASE: not a deployed agent.",
      "public class CollectionPolicy {",
      "  public int sampleInterval() {",
      `    return ${5 + profile};`, "  }", "}",
    ].join("\n") },
  ];
  if (profile === 1 || profile === 5 || regression >= 4) sourceEntries.push({ path: "src/legacy/SyntheticSettings.ts", text: "// SYNTHETIC: intentionally invalid configuration for a security finding.\nexport const password = 'SYNTHETIC-NOT-A-CREDENTIAL';\n" });
  const ruleText = ["# 합성 운영 코드 품질 규칙", "이 문서는 공개 시연용 합성 규칙이며 실제 시스템 규격이 아닙니다.", "`console.log()` 사용 금지", "`eval()` 사용 금지", "함수는 20줄 이하", "한 줄 길이는 100자 이하", "함수 이름은 camelCase 사용"].join("\n");
  const lines = Array.from({ length: 96 }, (_, i) => {
    const at = iso(instant - (95 - i) * 15 * MINUTE);
    const error = i % (15 - Math.min(8, profile + regression)) === 0;
    const warn = !error && i % 11 === 0;
    const level = error ? "ERROR" : warn ? "WARN" : "INFO";
    const message = error ? "synthetic request rejected: invalid demo route" : warn ? "synthetic retry scheduled after delayed response" : "synthetic request completed";
    return `${at} ${level} [SYNTHETIC] ${spec.host} ${message} responseMs=${spec.response + i % 17} sequence=${i}`;
  });
  return [
    { name: `${spec.code.toLowerCase()}-synthetic-source.zip`, kind: "SOURCE", entries: sourceEntries, notes: ["공개 시연용으로 생성한 합성 소스입니다. 실제 시스템 코드를 포함하지 않습니다."] },
    { name: "synthetic-quality-rules.md", kind: "RULE", entries: [{ path: "synthetic-quality-rules.md", text: ruleText }], notes: [] },
    { name: `${spec.code.toLowerCase()}-synthetic.log`, kind: "LOG", entries: [{ path: `${spec.code.toLowerCase()}-synthetic.log`, text: lines.join("\n") }], notes: ["시간·응답·오류를 포함한 모든 로그 값은 결정적 합성 데이터입니다."] },
  ];
}

export function showcaseAnalysis(profile: number, daysAgo: number, instant: number): AnalysisResult {
  const inputs = showcaseInputs(profile, daysAgo, instant);
  const result = analyzeUploads(inputs, iso(instant));
  const buckets = new Map<string, { bucket: string; error: number; warn: number; total: number }>();
  for (const line of inputs[2].entries[0].text.split("\n")) {
    const bucket = `${line.slice(0, 13)}:00:00.000Z`;
    const value = buckets.get(bucket) ?? { bucket, error: 0, warn: 0, total: 0 };
    value.total++; if (line.includes(" ERROR ")) value.error++; if (line.includes(" WARN ")) value.warn++;
    buckets.set(bucket, value);
  }
  result.logs.timeline = [...buckets.values()];
  result.notes.unshift("[합성 시연] 이력의 소스·로그를 실제 로컬 분석기로 검사한 결과입니다. 실제 시스템의 코드 품질이나 운영 상태와 무관합니다.");
  return result;
}

function historyAnalysis(db: MockDb, project: Project, profile: number, daysAgo: number, at: number): Analysis {
  const result = showcaseAnalysis(profile, daysAgo, at);
  const o = result.overview;
  return { id: id(db), projectId: project.id, status: "COMPLETED", createdAt: iso(at - 14_000), startedAt: iso(at - 12_000), completedAt: iso(at), score: o.score, grade: o.grade, criticalCount: o.critical, warningCount: o.warning, infoCount: o.info, summary: `[합성 시연] ${SHOWCASE_PROJECTS[profile].service} · ${o.score}점 (${o.grade}) · 심각 ${o.critical} / 주의 ${o.warning} / 참고 ${o.info}. 생성한 소스 ${result.source.analyzedFiles}개와 로그 ${result.logs.lines}줄의 검사 결과입니다.`, result };
}

function addEvent(db: MockDb, project: Project, type: "ANALYSIS_COMPLETED" | "AGENT_CONNECTED" | "INCIDENT_OPENED" | "INCIDENT_RESOLVED", time: number, title: string, message: string, level: "INFO" | "WARNING" | "ERROR" = "INFO") {
  (db.events ??= []).push({ id: id(db), projectId: project.id, projectName: project.name, type, level, title, message: `[합성 시연] ${message}`, createdAt: iso(time) });
}

function seededIncident(db: MockDb, project: Project, agent: Agent, profile: number, at: number, open: boolean, ordinal: number): Incident {
  const rule = open ? SHOWCASE_PROJECTS[profile].issue ?? "LATENCY" : ordinal % 2 ? "ERROR_SPIKE" : "LATENCY";
  const warning = rule === "MEMORY_HIGH" || rule === "DISK_HIGH";
  const severity = warning ? "WARNING" : "CRITICAL";
  const label = rule === "MEMORY_HIGH" ? "메모리 사용률 주의" : rule === "DISK_HIGH" ? "디스크 사용률 주의" : rule === "LATENCY" ? "응답 지연" : "오류 급증";
  const base = localInsight(rule === "ERROR_SPIKE" ? "ERROR_SPIKE" : "LATENCY", agent.hostname ?? agent.name);
  const insight: IncidentInsight = warning ? {
    ...base, severity, baselineResponseMs: SHOWCASE_PROJECTS[profile].response, currentResponseMs: SHOWCASE_PROJECTS[profile].response + 25, timeoutCount: 0, errorCount: 2,
    summary: `[합성 시연] ${agent.name}에서 ${label} 징후를 재현했습니다. ${rule === "MEMORY_HIGH" ? "메모리 86%" : "디스크 84%"}가 시연 주의 기준 80%를 넘었습니다.`,
    evidence: [`${rule === "MEMORY_HIGH" ? "메모리 86%" : "디스크 84%"} / 주의 기준 80%`, "합성 시계열의 최근 관찰 구간과 일치합니다.", "실제 서버 측정값이 아닙니다."],
    causes: [rule === "MEMORY_HIGH" ? "배치 요청 누적으로 메모리 사용이 늘어나는 상황을 가정했습니다." : "보관 중인 로그 파일이 증가하는 상황을 가정했습니다."],
    actions: [rule === "MEMORY_HIGH" ? "배치 동시 실행 수와 메모리 회수 추이를 확인하세요." : "로그 보관 주기와 디스크 정리 정책을 확인하세요.", "조치 후 사용률이 주의 기준 아래로 내려가는지 확인하세요."],
  } : { ...base, summary: `[합성 시연] ${base.summary}` };
  const incident: Incident = { id: id(db), projectId: project.id, projectName: project.name, projectCode: project.projectCode, agentId: agent.id, agentName: agent.name, rule, ruleLabel: label, severity, status: open ? "OPEN" : "RESOLVED", title: `[합성 시연] ${label} 감지`, detail: warning ? insight.evidence[0] : `합성 관찰: 응답 ${insight.currentResponseMs}ms · Timeout ${insight.timeoutCount}건 · 오류 ${insight.errorCount}건`, observed: warning ? rule === "MEMORY_HIGH" ? 86 : 84 : rule === "LATENCY" ? 3200 : 24, threshold: warning ? 80 : rule === "LATENCY" ? 1000 : 10, openedAt: iso(at), lastDetectedAt: iso(at + 2 * MINUTE), resolvedAt: open ? null : iso(at + (12 + ordinal * 2) * MINUTE), resolvedBy: open ? null : "DEMO", insight };
  (db.incidents ??= []).push(incident);
  addEvent(db, project, "INCIDENT_OPENED", at, incident.title, incident.detail ?? "", severity === "CRITICAL" ? "ERROR" : "WARNING");
  if (!open) addEvent(db, project, "INCIDENT_RESOLVED", Date.parse(incident.resolvedAt!), "합성 이상이 해결되었습니다", `${agent.name} · ${label}`);
  return incident;
}

function renameSyntheticLabels<T>(value: T, replacements: readonly (readonly [string, string])[]): T {
  if (typeof value === "string") return replacements.reduce<string>((text, [before, after]) => text.split(before).join(after), value) as T;
  if (Array.isArray(value)) return value.map((entry) => renameSyntheticLabels(entry, replacements)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, renameSyntheticLabels(entry, replacements)])) as T;
  return value;
}

/** Upgrade only records identified as authored showcase data; never reseed or replace user projects. */
function migrateShowcaseCatalog(db: MockDb): boolean {
  const state = db.showcase;
  if (!state || state.version >= SHOWCASE_VERSION) return false;
  for (const [rawId, seeded] of Object.entries(state.projects)) {
    const project = db.projects.find((p) => p.id === Number(rawId));
    const spec = SHOWCASE_PROJECTS[seeded.profile];
    const previous = PREVIOUS_LABELS[seeded.profile];
    if (!project || !spec || !previous) continue;
    const [oldCode, oldName, oldHost, oldService] = previous;
    const replacements: [string, string][] = [
      [oldHost, spec.host], [oldCode, spec.code], [oldCode.toLowerCase(), spec.code.toLowerCase()],
      [oldName, spec.name], [oldService, spec.service], ["실제 단지", "실제 시스템"],
      ["a residential service", "a production service"],
      ["월패드 연동 요청과 응답 형식", "서비스 연동 요청과 응답 형식"],
      ...(seeded.profile === 6 ? [["월패드 연동", "단지서버 연동"] as [string, string]] : []),
    ];
    if (project.name === oldName) project.name = spec.name;
    if (project.projectCode === oldCode && !db.projects.some((p) => p.id !== project.id && (p.createdBy ?? 1) === (project.createdBy ?? 1) && p.projectCode.toUpperCase() === spec.code.toUpperCase())) project.projectCode = spec.code;
    if (project.description?.startsWith("[합성 시연]")) project.description = renameSyntheticLabels(project.description, replacements);
    db.agents = db.agents?.map((agent) => agent.projectId === project.id && state.agents[agent.id] ? renameSyntheticLabels(agent, replacements) : agent);
    for (const file of db.files.filter((f) => f.projectId === project.id && state.files[f.id])) {
      state.files[file.id] = renameSyntheticLabels(state.files[file.id], replacements);
      file.originalFilename = state.files[file.id].name;
      file.fileSize = state.files[file.id].entries.reduce((size, entry) => size + new TextEncoder().encode(entry.text).length, 0);
    }
    db.analyses = db.analyses.map((analysis) => analysis.projectId === project.id && state.analyses[analysis.id] ? renameSyntheticLabels(analysis, replacements) : analysis);
    db.events = db.events?.map((event) => {
      if (event.projectId !== project.id) return event;
      const renamed = renameSyntheticLabels(event, replacements);
      renamed.projectName = project.name;
      return renamed;
    });
    db.incidents = db.incidents?.map((incident) => incident.projectId === project.id ? { ...renameSyntheticLabels(incident, replacements), projectName: project.name, projectCode: project.projectCode } : incident);
    const agentIds = new Set((db.agents ?? []).filter((agent) => agent.projectId === project.id && state.agents[agent.id]).map((agent) => agent.id));
    db.logs = db.logs?.map((entry) => agentIds.has(entry.agentId) && entry.source === "synthetic-live.log" ? renameSyntheticLabels(entry, replacements) : entry);
  }
  state.version = SHOWCASE_VERSION;
  return true;
}

/** Adds a user's gallery once. Deleted or edited projects are never silently recreated on reads. */
export function ensureShowcase(db: MockDb, ownerId: number, now: number): boolean {
  const state = db.showcase ??= { version: SHOWCASE_VERSION, owners: {}, projects: {}, agents: {}, files: {}, analyses: {} };
  const migrated = migrateShowcaseCatalog(db);
  if (state.owners[ownerId] || !db.users.some((u) => u.id === ownerId)) return migrated;
  const projectIds: number[] = [];
  SHOWCASE_PROJECTS.forEach((spec, profile) => {
    const existing = db.projects.find((p) => (p.createdBy ?? 1) === ownerId && p.projectCode === spec.code);
    if (existing) {
      // Upgrade only the old, explicitly synthetic agent's moving clock. Its
      // project, uploaded files, analysis history and incident state stay intact.
      if (spec.code === DEMO_CODE && db.demoAnchors?.[existing.id]) {
        (db.agents ?? []).filter((a) => a.projectId === existing.id && a.tokenPrefix === "demo-public").forEach((agent, ordinal) => {
          state.agents[agent.id] ??= { profile, ordinal, lastTick: iso(now - 60 * MINUTE) };
        });
      }
      return;
    }
    const project: Project = { id: id(db), projectCode: spec.code, name: spec.name, nickname: "합성 시연", description: `[합성 시연] ${spec.service}. 공개 시연을 위해 만든 가상 데이터이며 실제 시스템 운영 상태와 무관합니다.`, status: "ACTIVE", technologies: [{ category: "LANGUAGE", name: "TypeScript" }, { category: "LANGUAGE", name: "Java" }, { category: "LANGUAGE", name: "C#" }, { category: "FRAMEWORK", name: "Spring Boot" }, { category: "DATABASE", name: profile % 2 ? "PostgreSQL" : "MariaDB" }], fileCount: 3, createdBy: ownerId, createdAt: iso(now - (45 + profile * 3) * DAY), updatedAt: iso(now - (profile + 1) * MINUTE), lastAnalyzedAt: iso(now - (profile + 1) * MINUTE), recentEventCount: 0 };
    db.projects.push(project); projectIds.push(project.id);
    for (let day = 29; day >= 0; day--) {
      const at = now - day * DAY - (profile + 1) * MINUTE;
      const analysis = historyAnalysis(db, project, profile, day, at);
      state.analyses[analysis.id] = { profile, daysAgo: day, at };
      // Historical drilldowns are reconstructed from these authored inputs on demand,
      // instead of duplicating 210 full result documents in localStorage.
      if (day > 0) delete analysis.result;
      db.analyses.push(analysis);
      addEvent(db, project, "ANALYSIS_COMPLETED", at, "합성 소스·규칙 분석 완료", `${analysis.score}점 · ${analysis.warningCount}개 주의 항목`);
    }
    const latest = db.analyses[db.analyses.length - 1];
    state.projects[project.id] = { profile, seededAt: iso(now), latestSyntheticAnalysisId: latest.id };
    for (const input of showcaseInputs(profile, 0, now - (profile + 1) * MINUTE)) {
      const fileId = id(db);
      db.files.push({ id: fileId, projectId: project.id, fileType: input.kind, originalFilename: input.name, fileSize: input.entries.reduce((size, e) => size + new TextEncoder().encode(e.text).length, 0), mimeType: input.kind === "SOURCE" ? "application/zip" : "text/plain", createdAt: project.createdAt });
      state.files[fileId] = input;
    }
    const agents: Agent[] = [];
    for (let ordinal = 0; ordinal < spec.agents; ordinal++) {
      const agent: Agent = { id: id(db), projectId: project.id, name: `${spec.host}${ordinal ? "-worker" : ""}`, tokenPrefix: "synthetic", hostname: `${spec.host}${ordinal ? "-02" : "-01"}`, os: "Windows Server · 합성 시연", agentVersion: "synthetic-v1", ipAddress: `192.0.2.${10 + profile * 3 + ordinal}`, state: "ONLINE", lastSeenAt: iso(now), createdAt: project.createdAt };
      (db.agents ??= []).push(agent); agents.push(agent);
      state.agents[agent.id] = { profile, ordinal, lastTick: iso(now - 60 * MINUTE) };
      addEvent(db, project, "AGENT_CONNECTED", now - (40 + profile) * MINUTE, "합성 에이전트 수집 중", `${agent.name} · CPU/메모리/디스크/응답 지표`);
    }
    for (let day = 6; day >= 1; day--) {
      if ((day + profile) % 3 === 0) continue;
      seededIncident(db, project, agents[0], profile, now - day * DAY - (25 + profile * 9) * MINUTE, false, day);
    }
    if (spec.issue) seededIncident(db, project, agents[0], profile, now - (8 + profile * 2) * MINUTE, true, 0);
    db.demoAnchors = { ...db.demoAnchors, [project.id]: iso(minuteFloor(now)) };
  });
  state.owners[ownerId] = { projectIds, initializedAt: iso(now) };
  db.analyses.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  db.events?.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  db.incidents?.sort((a, b) => a.openedAt.localeCompare(b.openedAt) || a.id - b.id);
  refreshShowcase(db, now);
  return true;
}

export type ShowcaseMetric = MetricBucket & { responseMs: number };
export function showcaseMetrics(profile: number, ordinal: number, minutes: number, now: number, incidents: Incident[] = []): ShowcaseMetric[] {
  const spec = SHOWCASE_PROJECTS[profile];
  const range = Math.max(1, Math.min(1440, Math.floor(minutes)));
  const step = range > 360 ? 5 : range > 60 ? 2 : 1;
  const end = minuteFloor(now);
  const count = Math.floor(range / step) + 1;
  return Array.from({ length: count }, (_, index) => {
    const time = index === count - 1 ? now : end - (count - 1 - index) * step * MINUTE;
    const phase = time / MINUTE;
    const wave = Math.sin((phase + profile * 17 + ordinal * 7) / 11);
    const slow = Math.sin((phase + profile * 31) / 47);
    const cpuPct = round(Math.max(7, spec.cpu + wave * (8 + profile) + slow * 4 + ordinal * 7));
    let memoryPct = round(spec.memory + slow * 5 + wave * 1.4 + ordinal * 3);
    let diskPct = round(spec.disk + Math.sin(phase / 120 + profile) * 1.5 + ordinal * 2);
    let responseMs = Math.round(spec.response + wave * 21 + Math.max(0, slow) * 37 + ordinal * 12);
    for (const incident of incidents) {
      if (Date.parse(incident.openedAt) > time || (incident.resolvedAt && Date.parse(incident.resolvedAt) <= time)) continue;
      if (incident.rule === "MEMORY_HIGH") memoryPct = 86;
      else if (incident.rule === "DISK_HIGH") diskPct = 84;
      else if (incident.insight?.currentResponseMs) responseMs = incident.insight.currentResponseMs;
    }
    return { time: iso(time), cpuPct, memoryPct, diskPct, responseMs, netInKbps: round(150 + profile * 27 + ordinal * 20 + wave * 45), netOutKbps: round(86 + profile * 13 + slow * 24) };
  });
}

/** Move only synthetic telemetry forward; user activity and incident transitions retain their timestamps. */
export function refreshShowcase(db: MockDb, now: number): boolean {
  const state = db.showcase;
  if (!state) return false;
  let changed = false;
  const tick = minuteFloor(now);
  for (const [rawId, seeded] of Object.entries(state.projects)) {
    const projectId = Number(rawId);
    const project = db.projects.find((p) => p.id === projectId);
    const latest = db.analyses.filter((a) => a.projectId === projectId).at(-1);
    const previous = latest && state.analyses[latest.id];
    if (!project || !latest || !previous || db.files.some((f) => f.projectId === projectId && !state.files[f.id])) continue;
    const elapsedDays = Math.floor(now / DAY) - Math.floor(previous.at / DAY);
    if (elapsedDays < 1) continue;
    delete latest.result;
    for (let day = Math.min(29, elapsedDays - 1); day >= 0; day--) {
      const at = now - day * DAY - (seeded.profile + 1) * MINUTE;
      const analysis = historyAnalysis(db, project, seeded.profile, day, at);
      state.analyses[analysis.id] = { profile: seeded.profile, daysAgo: day, at };
      if (day > 0) delete analysis.result;
      db.analyses.push(analysis);
      seeded.latestSyntheticAnalysisId = analysis.id;
      addEvent(db, project, "ANALYSIS_COMPLETED", at, "합성 소스·규칙 분석 완료", `${analysis.score}점 · ${analysis.warningCount}개 주의 항목`);
      project.lastAnalyzedAt = iso(at);
    }
    const inputFiles = showcaseInputs(seeded.profile, 0, Date.parse(project.lastAnalyzedAt!));
    for (const file of db.files.filter((f) => f.projectId === projectId)) {
      const input = inputFiles.find((f) => f.name === file.originalFilename);
      if (input && state.files[file.id]) state.files[file.id] = input;
    }
    db.analyses = db.analyses.filter((a) => {
      if (a.projectId !== projectId || !state.analyses[a.id] || Date.parse(a.createdAt) >= now - 30 * DAY) return true;
      delete state.analyses[a.id]; return false;
    });
    changed = true;
  }
  for (const [rawId, seeded] of Object.entries(state.agents)) {
    const agent = db.agents?.find((a) => a.id === Number(rawId));
    if (!agent || agent.state !== "ONLINE" || Date.parse(seeded.lastTick) >= tick) continue;
    const incidents = (db.incidents ?? []).filter((i) => i.projectId === agent.projectId && (!i.agentId || i.agentId === agent.id));
    const latest = showcaseMetrics(seeded.profile, seeded.ordinal, 1, now, incidents).at(-1)!;
    agent.lastSeenAt = latest.time;
    agent.latest = { ...latest, collectedAt: latest.time };
    const first = Math.max(tick - 59 * MINUTE, minuteFloor(Date.parse(seeded.lastTick)) + MINUTE);
    for (let at = first; at <= tick; at += MINUTE) {
      const point = showcaseMetrics(seeded.profile, seeded.ordinal, 1, at, incidents).at(-1)!;
      const active = incidents.find((i) => i.status === "OPEN" && Date.parse(i.openedAt) <= at);
      const level = active ? active.severity === "CRITICAL" ? "ERROR" : "WARN" : "INFO";
      const entry: LogEntry = { id: id(db), agentId: agent.id, agentName: agent.name, source: "synthetic-live.log", level, loggedAt: iso(at), message: `[SYNTHETIC] ${agent.name} ${active ? active.ruleLabel : "request completed"}; responseMs=${point.responseMs} cpuPct=${point.cpuPct} memoryPct=${point.memoryPct} diskPct=${point.diskPct}; realServer=false` };
      (db.logs ??= []).push(entry);
    }
    seeded.lastTick = iso(tick);
    db.demoAnchors = { ...db.demoAnchors, [agent.projectId]: iso(tick) };
    changed = true;
  }
  if (changed) {
    // Keep a bounded recent synthetic stream; uploaded and non-showcase logs are untouched.
    db.logs = (db.logs ?? []).filter((l) => l.source !== "synthetic-live.log" || Date.parse(l.loggedAt) >= tick - 2 * 60 * MINUTE).sort((a, b) => a.id - b.id);
    db.analyses.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
    db.events?.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  }
  return changed;
}

export function materializeShowcaseAnalysis(db: MockDb, analysis: Analysis): Analysis {
  const seed = db.showcase?.analyses[analysis.id];
  return !analysis.result && seed ? { ...analysis, result: showcaseAnalysis(seed.profile, seed.daysAgo, seed.at) } : analysis;
}

export function showcaseHealth(projects: Project[], incidents: Incident[], now: number): { health: HealthSummary; incidentTrend: IncidentTrend[] } {
  const projectIds = new Set(projects.map((p) => p.id));
  const scoped = incidents.filter((i) => projectIds.has(i.projectId));
  const active = scoped.filter((i) => i.status === "OPEN");
  const critical = projects.filter((p) => active.some((i) => i.projectId === p.id && i.severity === "CRITICAL")).length;
  const warning = projects.filter((p) => !active.some((i) => i.projectId === p.id && i.severity === "CRITICAL") && active.some((i) => i.projectId === p.id && i.severity === "WARNING")).length;
  const dayKey = (time: string) => new Date(time).toLocaleDateString("sv-SE");
  return { health: { total: projects.length, normal: projects.length - critical - warning, warning, critical, openIncidents: active.length }, incidentTrend: Array.from({ length: 7 }, (_, i) => {
    const date = dayKey(iso(now - (6 - i) * DAY));
    return { date, opened: scoped.filter((x) => dayKey(x.openedAt) === date).length, resolved: scoped.filter((x) => x.resolvedAt && dayKey(x.resolvedAt) === date).length };
  }) };
}
