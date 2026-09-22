import type {
  ActivityEvent,
  Agent,
  AgentCreated,
  AlertChannel,
  AlertChannelRequest,
  AlertDelivery,
  AlertRule,
  AlertRuleRequest,
  Analysis,
  AnalysisListItem,
  AuthResponse,
  Dashboard,
  DemoSeed,
  EventLevel,
  EventPage,
  EventSummary,
  EventType,
  Incident,
  IncidentStatus,
  LogEntry,
  LoginRequest,
  MetricSeriesResponse,
  MonitoringOverview,
  PasswordChangeRequest,
  ProfileUpdateRequest,
  SystemStatus,
  Project,
  ProjectCreateRequest,
  ProjectFile,
  ProjectFileType,
  ProjectUpdateRequest,
  SignupRequest,
  User,
} from "@/types";
import { analyzeUploads } from "./analyzer";
import { parseUpload, readParsedFile, saveParsedFile, deleteParsedFiles, type ParsedUpload } from "./documentParser";
import { DEMO_CODE, localInsight, seededMetrics, slackMessage, type DemoScenario } from "./demoData";
import type { LogQuery } from "../agentApi";
import { ensureShowcase, refreshShowcase, materializeShowcaseAnalysis, showcaseMetrics, showcaseHealth, MOCK_STORAGE_KEY, LEGACY_MOCK_STORAGE_KEY, SHOWCASE_PROJECTS, type ShowcaseState } from "./showcaseData";

const KEY = MOCK_STORAGE_KEY;

interface MockUser extends User {
  password: string;
}

export interface MockDb {
  seq: number;
  users: MockUser[];
  projects: Project[];
  files: ProjectFile[];
  analyses: Analysis[];
  events?: ActivityEvent[];
  agents?: Agent[];
  alertChannels?: (AlertChannel & { url: string; createdBy?: number })[];
  alertRules?: (AlertRule & { createdBy?: number })[];
  deliveries?: AlertDelivery[];
  incidents?: Incident[];
  logs?: LogEntry[];
  demoAnchors?: Record<number, string>;
  showcase?: ShowcaseState;
}

function emptyDb(): MockDb {
  return {
    seq: 1,
    users: [
      {
        id: 1,
        email: "admin@xisnd.com",
        password: "test1234",
        name: "관리자",
        company: "XISND",
        department: "DX팀",
        role: "ADMIN",
        createdAt: new Date().toISOString(),
      },
    ],
    projects: [],
    files: [],
    analyses: [],
  };
}

function read(): MockDb {
  if (typeof window === "undefined") return emptyDb();
  const raw = window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_MOCK_STORAGE_KEY);
  let db = emptyDb();
  if (raw) {
    try {
      const stored = JSON.parse(raw) as MockDb;
      if (!Array.isArray(stored.users) || !Array.isArray(stored.projects) || !Array.isArray(stored.files) || !Array.isArray(stored.analyses) || !Number.isFinite(stored.seq)) throw new Error("Invalid saved database");
      db = stored;
    } catch {
      // Preserve unreadable saved data rather than silently replacing it with an empty DB.
      throw new Error("저장된 데모 데이터를 읽을 수 없습니다. 기존 데이터를 보존했으며, 새 브라우저 프로필에서 시연을 시작할 수 있습니다.");
    }
  }
  let changed = !window.localStorage.getItem(KEY);
  for (const analysis of db.analyses) {
    if (analysis.status === "COMPLETED" && !db.showcase?.analyses[analysis.id] && !analysis.result?.source.available && !analysis.result?.logs.available) {
      analysis.status = "FAILED";
      analysis.score = null;
      analysis.grade = null;
      analysis.result = null;
      analysis.summary = "이전 목 분석에는 실제 입력 근거가 없습니다. 파일을 다시 올린 뒤 분석해주세요.";
      changed = true;
    }
  }
  changed = ensureShowcase(db, currentUserId(), Date.now()) || changed;
  changed = refreshShowcase(db, Date.now()) || changed;
  if (changed) write(db);
  return db;
}

function write(db: MockDb) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { throw new Error("브라우저 저장 공간이 부족합니다. 이전 데이터는 보존되었습니다. 새 브라우저 프로필에서 시연을 시작해주세요."); }
}

function currentUserId(): number {
  return typeof window === "undefined" ? 1 : Number((window.localStorage.getItem("mp.token") ?? "mock-1").replace("mock-", ""));
}
function ownedProjects(db: MockDb): Project[] {
  return db.projects.filter((p) => (p.createdBy ?? 1) === currentUserId());
}
function ownedProject(db: MockDb, id: number): Project {
  const project = ownedProjects(db).find((p) => p.id === id);
  if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
  return project;
}
function ownedEvents(db: MockDb): ActivityEvent[] {
  const ids = new Set(ownedProjects(db).map((p) => p.id));
  return (db.events ?? []).filter((e) => !!e.projectId && ids.has(e.projectId));
}

function nextId(db: MockDb): number {
  db.seq += 1;
  return db.seq;
}

function pushEvent(db: MockDb, project: Project | undefined, type: EventType, level: EventLevel, title: string, message?: string | null) {
  db.events = db.events ?? [];
  db.events.unshift({
    id: nextId(db),
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    type,
    level,
    title,
    message: message ?? null,
    createdAt: new Date().toISOString(),
  });
  db.events = db.events.slice(0, 500);
}

function userOf(db: MockDb, token: string): MockUser {
  const user = db.users.find((u) => u.id === Number(token.replace("mock-", "")));
  if (!user) throw new Error("세션이 만료되었습니다.");
  return user;
}

// Parsing runs locally; a short queued state preserves the same asynchronous UI flow.
type EventFilter = { projectId?: number; days?: number; q?: string };

function filterEvents(events: ActivityEvent[], f: EventFilter): ActivityEvent[] {
  const q = f.q?.trim().toLowerCase();
  const since = f.days ? Date.now() - f.days * 86_400_000 : 0;
  return events.filter(
    (e) =>
      (!f.projectId || e.projectId === f.projectId) &&
      Date.parse(e.createdAt) >= since &&
      (!q || [e.title, e.message, e.projectName].some((v) => v?.toLowerCase().includes(q))),
  );
}

function settleAnalyses(db: MockDb): MockDb {
  const now = Date.now();
  let changed = false;
  for (const a of db.analyses) {
    if ((a.status !== "QUEUED" && a.status !== "ANALYZING") || now - Date.parse(a.createdAt) < 3000) continue;
    a.status = "COMPLETED";
    a.completedAt = new Date().toISOString();
    if (!a.result) {
      a.status = "FAILED";
      a.summary = "이전 버전의 분석에는 실제 입력 근거가 없습니다. 파일을 다시 올린 뒤 분석해주세요.";
      a.score = null;
      a.grade = null;
      changed = true;
      continue;
    }
    const result = a.result.overview;
    a.score = result.score;
    a.grade = result.grade;
    a.criticalCount = result.critical;
    a.warningCount = result.warning;
    a.infoCount = result.info;
    a.summary = `실제 입력 분석: ${result.score}점 (${result.grade}) · 심각 ${result.critical}건 · 주의 ${result.warning}건 · 참고 ${result.info}건\n${a.result.notes[0]}`;
    const p = db.projects.find((x) => x.id === a.projectId);
    if (p) {
      p.status = "ACTIVE";
      p.lastAnalyzedAt = a.completedAt;
    }
    pushEvent(db, p, "ANALYSIS_COMPLETED", "INFO", "분석이 완료되었습니다", `${result.score}점 · 실제 파일 및 규칙 기반`);
    changed = true;
  }
  if (changed) write(db);
  return db;
}

function delay<T>(value: T, ms = 380): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function stripPassword({ password: _password, ...user }: MockUser): User {
  return user;
}

export const mockApi = {
  async signup(body: SignupRequest): Promise<AuthResponse> {
    const db = read();
    if (db.users.some((u) => u.email.toLowerCase() === body.email.toLowerCase())) {
      throw new Error("이미 가입된 이메일입니다.");
    }
    const user: MockUser = {
      id: nextId(db),
      email: body.email,
      password: body.password,
      name: body.name,
      company: body.company ?? null,
      department: body.department ?? null,
      role: "USER",
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    write(db);
    return delay({ token: `mock-${user.id}`, user: stripPassword(user) });
  },

  async login(body: LoginRequest): Promise<AuthResponse> {
    const db = read();
    const user = db.users.find((u) => u.email.toLowerCase() === body.email.toLowerCase());
    if (!user || user.password !== body.password) {
      throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
    }
    return delay({ token: `mock-${user.id}`, user: stripPassword(user) });
  },

  async me(token: string): Promise<User> {
    const db = read();
    const id = Number(token.replace("mock-", ""));
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new Error("세션이 만료되었습니다.");
    return delay(stripPassword(user), 120);
  },

  async listProjects(): Promise<Project[]> {
    const db = read();
    const withCounts = ownedProjects(db).map((p) => ({
      ...p,
      fileCount: db.files.filter((f) => f.projectId === p.id).length,
    }));
    return delay(withCounts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  async getProject(id: number): Promise<Project> {
    const db = read();
    const project = ownedProject(db, id);
    return delay({ ...project, fileCount: db.files.filter((f) => f.projectId === id).length });
  },

  async createProject(body: ProjectCreateRequest): Promise<Project> {
    const db = read();
    if (ownedProjects(db).some((p) => p.projectCode.toUpperCase() === body.projectCode.toUpperCase())) {
      throw new Error("이미 사용 중인 프로젝트 코드입니다.");
    }
    const now = new Date().toISOString();
    const project: Project = {
      id: nextId(db),
      projectCode: body.projectCode,
      name: body.name,
      nickname: body.nickname ?? null,
      description: body.description ?? null,
      status: "READY",
      technologies: body.technologies,
      fileCount: 0,
      lastAnalyzedAt: null,
      recentEventCount: 0,
      createdBy: currentUserId(),
      createdAt: now,
      updatedAt: now,
    };
    db.projects.push(project);
    pushEvent(db, project, "PROJECT_CREATED", "INFO", "프로젝트를 만들었습니다", project.projectCode);
    write(db);
    return delay(project, 700);
  },

  async updateProject(id: number, body: ProjectUpdateRequest): Promise<Project> {
    const db = read();
    ownedProject(db, id);
    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error("프로젝트를 찾을 수 없습니다.");
    db.projects[idx] = { ...db.projects[idx], ...body, projectCode: db.projects[idx].projectCode, createdBy: db.projects[idx].createdBy, updatedAt: new Date().toISOString() };
    write(db);
    return delay(db.projects[idx]);
  },

  async deleteProject(id: number): Promise<void> {
    const db = read();
    ownedProject(db, id);
    pushEvent(db, db.projects.find((p) => p.id === id), "PROJECT_DELETED", "WARNING", "프로젝트를 삭제했습니다");
    db.projects = db.projects.filter((p) => p.id !== id);
    db.agents = (db.agents ?? []).filter((a) => a.projectId !== id);
    db.alertRules = (db.alertRules ?? []).filter((r) => r.projectId !== id);
    db.files = db.files.filter((f) => f.projectId !== id);
    db.analyses = db.analyses.filter((a) => a.projectId !== id);
    db.incidents = (db.incidents ?? []).filter((a) => a.projectId !== id);
    write(db);
    return delay(undefined);
  },

  async checkCode(code: string): Promise<boolean> {
    const db = read();
    return delay(!ownedProjects(db).some((p) => p.projectCode.toUpperCase() === code.toUpperCase()), 260);
  },

  async listFiles(projectId: number): Promise<ProjectFile[]> {
    const db = read();
    ownedProject(db, projectId);
    return delay(db.files.filter((f) => f.projectId === projectId));
  },

  async addFile(projectId: number, file: File, fileType: ProjectFileType): Promise<ProjectFile> {
    ownedProject(read(), projectId);
    const parsed = await parseUpload(file, fileType);
    const db = read();
    ownedProject(db, projectId);
    const saved: ProjectFile = {
      id: nextId(db),
      projectId,
      fileType,
      originalFilename: file.name,
      storedFilename: `${Date.now()}_${file.name}`,
      fileSize: file.size,
      mimeType: file.type || null,
      createdAt: new Date().toISOString(),
    };
    db.files.push(saved);
    await saveParsedFile(saved.id, parsed);
    pushEvent(db, db.projects.find((p) => p.id === projectId), "FILE_UPLOADED", "INFO", "파일을 올렸습니다", file.name);
    write(db);
    return delay(saved, 200);
  },

  async deleteFile(fileId: number): Promise<void> {
    const db = read();
    const target = db.files.find((f) => f.id === fileId);
    if (target) {
      ownedProject(db, target.projectId);
      pushEvent(db, db.projects.find((p) => p.id === target.projectId), "FILE_DELETED", "INFO", "파일을 삭제했습니다", target.originalFilename);
    }
    db.files = db.files.filter((f) => f.id !== fileId);
    write(db);
    return delay(undefined, 150);
  },

  async startAnalysis(projectId: number): Promise<Analysis> {
    const before = read();
    ownedProject(before, projectId);
    const projectFiles = before.files.filter((f) => f.projectId === projectId);
    const parsed = await Promise.all(projectFiles.filter((f) => f.fileType !== "ETC").map((f) => before.showcase?.files[f.id] ?? readParsedFile(f.id)));
    if (parsed.some((p) => !p)) throw new Error("일부 파일의 실제 내용이 저장되어 있지 않습니다. 해당 파일을 다시 업로드해주세요.");
    const result = analyzeUploads(parsed.filter((p): p is ParsedUpload => !!p));
    const db = read();
    ownedProject(db, projectId);
    const now = new Date().toISOString();
    const analysis: Analysis = {
      id: nextId(db),
      projectId,
      status: "QUEUED",
      startedAt: now,
      completedAt: null,
      summary: null,
      createdAt: now,
      result,
    };
    db.analyses.push(analysis);
    const p = db.projects.find((x) => x.id === projectId);
    if (p) {
      p.status = "ANALYZING";
      p.updatedAt = now;
    }
    pushEvent(db, p, "ANALYSIS_STARTED", "INFO", "분석을 시작했습니다");
    write(db);
    return delay(analysis, 600);
  },

  async latestAnalysis(projectId: number): Promise<Analysis | null> {
    const db = settleAnalyses(read());
    ownedProject(db, projectId);
    const list = db.analyses.filter((a) => a.projectId === projectId);
    return delay(list.length ? materializeShowcaseAnalysis(db, list[list.length - 1]) : null, 200);
  },

  async analysis(projectId: number, analysisId: number): Promise<Analysis> {
    const db = settleAnalyses(read());
    ownedProject(db, projectId);
    const found = db.analyses.find((a) => a.id === analysisId && a.projectId === projectId);
    if (!found) throw new Error("분석을 찾을 수 없습니다.");
    return delay(materializeShowcaseAnalysis(db, found), 200);
  },

  async analysisHistory(projectId: number): Promise<Analysis[]> {
    const db = settleAnalyses(read());
    ownedProject(db, projectId);
    return delay(db.analyses.filter((a) => a.projectId === projectId).reverse());
  },

  async allAnalyses(): Promise<AnalysisListItem[]> {
    const db = settleAnalyses(read());
    const items = db.analyses
      .slice()
      .filter((a) => ownedProjects(db).some((p) => p.id === a.projectId))
      .reverse()
      .map((a) => {
        const p = db.projects.find((x) => x.id === a.projectId);
        return {
          id: a.id,
          projectId: a.projectId,
          projectName: p?.name ?? "-",
          projectCode: p?.projectCode ?? "-",
          status: a.status,
          startedAt: a.startedAt,
          completedAt: a.completedAt,
          score: a.score ?? null,
          grade: a.grade ?? null,
          critical: a.criticalCount ?? null,
          warning: a.warningCount ?? null,
          info: a.infoCount ?? null,
          summary: a.status === "FAILED" ? a.summary : null,
        };
      })
      .filter((a) => a.projectName !== "-");
    return delay(items);
  },

  async dashboard(): Promise<Dashboard> {
    const all = settleAnalyses(read());
    const projects = ownedProjects(all);
    const ids = new Set(projects.map((p) => p.id));
    const db = { ...all, projects, analyses: all.analyses.filter((a) => ids.has(a.projectId)), files: all.files.filter((f) => ids.has(f.projectId)) };
    const count = (s: Project["status"]) => db.projects.filter((p) => p.status === s).length;
    const health = db.projects.map((p) => {
      const list = db.analyses.filter((a) => a.projectId === p.id);
      const latest = list[list.length - 1];
      const done = list.filter((a) => a.status === "COMPLETED").pop();
      return {
        projectId: p.id,
        name: p.name,
        projectCode: p.projectCode,
        status: p.status,
        lastAnalyzedAt: p.lastAnalyzedAt,
        latestStatus: latest?.status ?? null,
        score: done?.score ?? null,
        grade: done?.grade ?? null,
        critical: done?.criticalCount ?? null,
        warning: done?.warningCount ?? null,
        info: done?.infoCount ?? null,
      };
    });
    const scored = health.filter((h) => h.score != null);
    return delay({
      ...showcaseHealth(projects, all.incidents ?? [], Date.now()),
      projects: { total: db.projects.length, ready: count("READY"), analyzing: count("ANALYZING"), active: count("ACTIVE"), error: count("ERROR") },
      fileCount: db.files.length,
      analyses: {
        total: db.analyses.length,
        running: db.analyses.filter((a) => a.status === "QUEUED" || a.status === "ANALYZING").length,
        completed: db.analyses.filter((a) => a.status === "COMPLETED").length,
        failed: db.analyses.filter((a) => a.status === "FAILED").length,
        averageScore: scored.length ? Math.round(scored.reduce((s, h) => s + (h.score ?? 0), 0) / scored.length) : null,
      },
      severity: {
        critical: scored.reduce((s, h) => s + (h.critical ?? 0), 0),
        warning: scored.reduce((s, h) => s + (h.warning ?? 0), 0),
        info: scored.reduce((s, h) => s + (h.info ?? 0), 0),
      },
      projectHealth: health,
      recentEvents: ownedEvents(db).slice(0, 8),
    });
  },

  async systemStatus(): Promise<SystemStatus> {
    return delay({
      services: [
        { key: "api", name: "백엔드 API", status: "MOCK", detail: "브라우저 데모 모드", latencyMs: null },
        { key: "db", name: "데이터베이스", status: "MOCK", detail: "로컬스토리지", latencyMs: null },
        { key: "analysis", name: "분석 서비스", status: "MOCK", detail: "브라우저에서 실제 파일·규칙 분석", latencyMs: null },
        {
          key: "agent",
          name: "수집 에이전트",
          status: "MOCK",
          detail: "합성 시드 기반 에이전트 시계열·로그",
          latencyMs: null,
        },
      ],
      checkedAt: new Date().toISOString(),
    });
  },

  async events(params: EventFilter & { level?: EventLevel; sort?: "asc" | "desc"; page?: number; size?: number }): Promise<EventPage> {
    const db = settleAnalyses(read());
    if (params.projectId) ownedProject(db, params.projectId);
    const size = params.size ?? 30;
    const page = params.page ?? 0;
    const all = filterEvents(ownedEvents(db), params).filter((e) => !params.level || e.level === params.level);
    if (params.sort === "asc") all.reverse();
    return delay({
      items: all.slice(page * size, (page + 1) * size),
      page,
      size,
      total: all.length,
      hasNext: (page + 1) * size < all.length,
    });
  },

  async eventSummary(params: EventFilter): Promise<EventSummary> {
    const db = read();
    if (params.projectId) ownedProject(db, params.projectId);
    const list = filterEvents(ownedEvents(db), params);
    const scoped = ownedEvents(db).filter((e) => !params.projectId || e.projectId === params.projectId);
    const age = (e: ActivityEvent) => Date.now() - Date.parse(e.createdAt);
    const count = (level: EventLevel) => list.filter((e) => e.level === level).length;
    return delay({
      total: list.length,
      error: count("ERROR"),
      warning: count("WARNING"),
      info: count("INFO"),
      last24h: scoped.filter((e) => age(e) < 86_400_000).length,
      prev24h: scoped.filter((e) => age(e) >= 86_400_000 && age(e) < 2 * 86_400_000).length,
    });
  },

  async updateProfile(token: string, body: ProfileUpdateRequest): Promise<User> {
    const db = read();
    const user = userOf(db, token);
    user.name = body.name;
    user.company = body.company || null;
    user.department = body.department || null;
    write(db);
    return delay(stripPassword(user));
  },

  async changePassword(token: string, body: PasswordChangeRequest): Promise<void> {
    const db = read();
    const user = userOf(db, token);
    if (user.password !== body.currentPassword) throw new Error("현재 비밀번호가 올바르지 않습니다.");
    if (body.currentPassword === body.newPassword) throw new Error("새 비밀번호가 현재 비밀번호와 같습니다.");
    user.password = body.newPassword;
    write(db);
    return delay(undefined);
  },

  async agents(projectId: number): Promise<Agent[]> {
    const db = read();
    ownedProject(db, projectId);
    return delay((db.agents ?? []).filter((a) => a.projectId === projectId));
  },

  async createAgent(projectId: number, name: string): Promise<AgentCreated> {
    const db = read();
    ownedProject(db, projectId);
    const token = `agt_demo${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
    const agent: Agent = {
      id: nextId(db),
      projectId,
      name: name.trim(),
      tokenPrefix: token.slice(0, 12),
      state: "PENDING",
      createdAt: new Date().toISOString(),
    };
    db.agents = [...(db.agents ?? []), agent];
    pushEvent(db, db.projects.find((p) => p.id === projectId), "AGENT_REGISTERED", "INFO", "에이전트를 등록했습니다", agent.name);
    write(db);
    return delay({ agent, token }, 500);
  },

  async deleteAgent(projectId: number, agentId: number): Promise<void> {
    const db = read();
    ownedProject(db, projectId);
    const target = (db.agents ?? []).find((a) => a.id === agentId && a.projectId === projectId);
    db.agents = (db.agents ?? []).filter((a) => a.id !== agentId || a.projectId !== projectId);
    if (target) {
      pushEvent(db, db.projects.find((p) => p.id === projectId), "AGENT_DELETED", "WARNING", "에이전트를 삭제했습니다", target.name);
    }
    write(db);
    return delay(undefined);
  },

  async logEntries(projectId: number, query: LogQuery = {}): Promise<LogEntry[]> {
    const db = read();
    ownedProject(db, projectId);
    const ids = new Set((db.agents ?? []).filter((a) => a.projectId === projectId && (!query.agentId || a.id === query.agentId)).map((a) => a.id));
    return delay((db.logs ?? []).filter((l) => ids.has(l.agentId) && (!query.level || query.level === "ALL" || l.level === query.level || query.level === "WARN" && ["ERROR", "FATAL"].includes(l.level) || query.level === "ERROR" && l.level === "FATAL") && (!query.q || l.message.toLowerCase().includes(query.q.toLowerCase())) && (!query.afterId || l.id > query.afterId)).slice(-(query.limit ?? 200)).reverse(), 80);
  },

  async metrics(projectId: number, minutes: number, agentId?: number): Promise<MetricSeriesResponse> {
    const db = read();
    ownedProject(db, projectId);
    const now = Date.now();
    const anchor = db.demoAnchors?.[projectId];
    const range = Math.max(1, Math.min(1440, Math.floor(minutes)));
    const bucketSeconds = range > 360 ? 300 : range > 60 ? 120 : 60;
    return delay({ minutes: range, bucketSeconds, series: (db.agents ?? []).filter((a) => a.projectId === projectId && a.state === "ONLINE" && (!agentId || a.id === agentId)).flatMap((a) => {
      const seed = db.showcase?.agents[a.id];
      const incidents = (db.incidents ?? []).filter((i) => i.projectId === projectId && (!i.agentId || i.agentId === a.id));
      if (seed) return [{ agentId: a.id, agentName: a.name, points: showcaseMetrics(seed.profile, seed.ordinal, range, now, incidents) }];
      // Legacy safe-demo agents also use a moving clock, so an overnight tab stays populated.
      return anchor ? [{ agentId: a.id, agentName: a.name, points: seededMetrics(new Date(now).toISOString()) }] : [];
    }) }, 80);
  },

  async monitoringOverview(): Promise<MonitoringOverview> {
    const db = read();
    const projects = ownedProjects(db);
    const ids = new Set(projects.map((p) => p.id));
    const agents = (db.agents ?? []).filter((a) => ids.has(a.projectId));
    const logs = (db.logs ?? []).filter((l) => agents.some((a) => a.id === l.agentId) && Date.parse(l.loggedAt) > Date.now() - 3600_000);
    const incidents = (db.incidents ?? []).filter((i) => ids.has(i.projectId) && i.status === "OPEN");
    return delay({
      ...showcaseHealth(projects, db.incidents ?? [], Date.now()),
      agentsTotal: agents.length,
      agentsOnline: agents.filter((a) => a.state === "ONLINE").length,
      errors1h: logs.filter((l) => l.level === "ERROR" || l.level === "FATAL").length,
      openIncidents: incidents.length,
      projects: projects.map((p) => ({
        projectId: p.id,
        name: p.name,
        projectCode: p.projectCode,
        agents: agents.filter((a) => a.projectId === p.id),
        logs1h: { error: logs.filter((l) => agents.some((a) => a.projectId === p.id && a.id === l.agentId) && (l.level === "ERROR" || l.level === "FATAL")).length, warn: logs.filter((l) => agents.some((a) => a.projectId === p.id && a.id === l.agentId) && l.level === "WARN").length, total: logs.filter((l) => agents.some((a) => a.projectId === p.id && a.id === l.agentId)).length },
        openIncidents: incidents.filter((i) => i.projectId === p.id).length,
      })),
      checkedAt: new Date().toISOString(),
    });
  },

  async incidents(params: { projectId?: number; status?: IncidentStatus; limit?: number } = {}): Promise<Incident[]> {
    const db = read();
    if (params.projectId) ownedProject(db, params.projectId);
    const ids = new Set(ownedProjects(db).map((p) => p.id));
    return delay((db.incidents ?? []).filter((i) => ids.has(i.projectId) && (!params.projectId || i.projectId === params.projectId) && (!params.status || i.status === params.status)).slice().reverse().slice(0, params.limit ?? 50), 80);
  },

  async resolveIncident(id: number): Promise<Incident> {
    const db = read();
    const incident = (db.incidents ?? []).find((i) => i.id === id);
    if (!incident) throw new Error("이상 기록을 찾을 수 없습니다.");
    const project = ownedProject(db, incident.projectId);
    if (incident.status === "OPEN") {
      incident.status = "RESOLVED";
      incident.resolvedAt = new Date().toISOString();
      incident.resolvedBy = "USER";
      for (const agent of (db.agents ?? []).filter((a) => a.projectId === project.id)) {
        if (db.showcase?.agents[agent.id]) db.showcase.agents[agent.id].lastTick = new Date(Date.now() - 60_000).toISOString();
      }
      pushEvent(db, project, "INCIDENT_RESOLVED", "INFO", "이상을 해결했습니다", incident.title);
      write(db);
    }
    return delay(incident, 80);
  },

  async incidentPreview(id: number) {
    const db = read();
    const incident = (db.incidents ?? []).find((i) => i.id === id);
    if (!incident) throw new Error("이상 기록을 찾을 수 없습니다.");
    ownedProject(db, incident.projectId);
    return { message: slackMessage(incident), externalDelivery: false };
  },

  async seedDemo(): Promise<DemoSeed> {
    const db = read();
    const found = ownedProjects(db).find((p) => p.projectCode === DEMO_CODE);
    if (found) {
      const agent = (db.agents ?? []).find((a) => a.projectId === found.id);
      const analysis = db.analyses.filter((a) => a.projectId === found.id).at(-1);
      if (agent && analysis) return { projectId: found.id, agentId: agent.id, analysisId: analysis.id };
    }
    const project = found ?? await mockApi.createProject({ name: "단지서버", projectCode: DEMO_CODE, description: "실제 시스템에 접속하지 않는 단지서버 합성 시연 프로젝트", technologies: [{ category: "LANGUAGE", name: "TypeScript" }] });
      for (const [name, kind] of [["wallpad-source.zip", "SOURCE"], ["rules.md", "RULE"], ["gaepo-synthetic.log", "LOG"], ["buksuwon-synthetic.log", "LOG"]] as const) {
        if (read().files.some((f) => f.projectId === project.id && f.originalFilename === name && f.fileType === kind)) continue;
        const response = await fetch(`/demo/${name}`);
        if (!response.ok) throw new Error(`시연 파일 ${name}을 읽지 못했습니다. 데모 파일 준비를 확인해주세요.`);
        await mockApi.addFile(project.id, new File([await response.blob()], name), kind);
      }
    const analysis = await mockApi.startAnalysis(project.id);
    const next = read();
    const now = new Date().toISOString();
    const points = seededMetrics(now);
    const last = points[points.length - 1];
    const agent: Agent = { id: nextId(next), projectId: project.id, name: "단지서버 시연 에이전트", tokenPrefix: "demo-public", hostname: "complex-server-01", os: "Windows (synthetic)", agentVersion: "demo-v1", state: "ONLINE", lastSeenAt: now, createdAt: now, latest: { collectedAt: now, ...last } };
    next.agents = [...(next.agents ?? []), agent];
    next.demoAnchors = { ...next.demoAnchors, [project.id]: now };
    next.logs = [...(next.logs ?? []), ...Array.from({ length: 20 }, (_, index): LogEntry => ({ id: nextId(next), agentId: agent.id, agentName: agent.name, source: "synthetic-wallpad.log", level: "INFO", message: `[DEMO] gateway response received copy=00-0001 durationMs=120 sample=${index}`, loggedAt: new Date(Date.parse(now) - (19 - index) * 30_000).toISOString() }))];
    pushEvent(next, next.projects.find((p) => p.id === project.id), "AGENT_CONNECTED", "INFO", "시연 에이전트가 연결되었습니다", "결정적 합성 지표 60개·최근 로그 20개 준비");
    // Parsing already finished, so make the seed analysis immediately reviewable.
    const saved = next.analyses.find((a) => a.id === analysis.id);
    if (saved) saved.createdAt = new Date(Date.now() - 4000).toISOString();
    write(next);
    settleAnalyses(next);
    return { projectId: project.id, agentId: agent.id, analysisId: analysis.id };
  },

  async resetDemo(): Promise<void> {
    const db = read();
    const state = db.showcase;
    if (!state) return;
    // Reset only authored gallery data. Projects with uploaded files or renamed titles
    // are retained, together with every migrated project and another user's records.
    const ids = new Set(ownedProjects(db).filter((p) => {
      const seed = state.projects[p.id];
      return !!seed && p.name === SHOWCASE_PROJECTS[seed.profile].name && p.nickname === "합성 시연" && !db.files.some((f) => f.projectId === p.id && !state.files[f.id]);
    }).map((p) => p.id));
    const agentIds = new Set((db.agents ?? []).filter((a) => ids.has(a.projectId)).map((a) => a.id));
    const fileIds = db.files.filter((f) => ids.has(f.projectId)).map((f) => f.id);
    await deleteParsedFiles(fileIds.filter((fileId) => !state.files[fileId]));
    db.projects = db.projects.filter((p) => !ids.has(p.id));
    db.files = db.files.filter((f) => !ids.has(f.projectId));
    db.analyses = db.analyses.filter((a) => !ids.has(a.projectId));
    db.agents = (db.agents ?? []).filter((a) => !ids.has(a.projectId));
    db.incidents = (db.incidents ?? []).filter((i) => !ids.has(i.projectId));
    db.events = (db.events ?? []).filter((e) => !e.projectId || !ids.has(e.projectId));
    db.logs = (db.logs ?? []).filter((l) => !agentIds.has(l.agentId));
    db.alertRules = (db.alertRules ?? []).filter((r) => !r.projectId || !ids.has(r.projectId));
    db.deliveries = (db.deliveries ?? []).filter((d) => !d.projectId || !ids.has(d.projectId));
    for (const id of ids) if (db.demoAnchors) delete db.demoAnchors[id];
    for (const projectId of ids) delete state.projects[projectId];
    for (const agentId of agentIds) delete state.agents[agentId];
    for (const fileId of fileIds) delete state.files[fileId];
    for (const key of Object.keys(state.analyses)) if (!db.analyses.some((a) => a.id === Number(key))) delete state.analyses[Number(key)];
    delete state.owners[currentUserId()];
    ensureShowcase(db, currentUserId(), Date.now());
    write(db);
  },

  async triggerDemo(projectId: number, scenario: DemoScenario): Promise<Incident> {
    const db = read();
    const project = ownedProject(db, projectId);
    if (project.projectCode !== DEMO_CODE || !db.demoAnchors?.[projectId]) throw new Error("먼저 안전 시연 데이터를 준비해주세요.");
    const rule = scenario === "LATENCY" ? "LATENCY" : "ERROR_SPIKE";
    const existing = (db.incidents ?? []).find((i) => i.projectId === projectId && i.rule === rule && i.status === "OPEN");
    if (existing) return existing;
    const agent = (db.agents ?? []).find((a) => a.projectId === projectId && a.state === "ONLINE");
    if (!agent) throw new Error("시연 에이전트를 찾을 수 없습니다.");
    const now = new Date().toISOString();
    const insight = localInsight(scenario, agent.hostname ?? agent.name);
    const incident: Incident = { id: nextId(db), projectId, projectName: project.name, projectCode: project.projectCode, agentId: agent.id, agentName: agent.name, rule, ruleLabel: scenario === "LATENCY" ? "응답 지연" : "오류 추세 이상", severity: "CRITICAL", status: "OPEN", title: `${project.name} ${scenario === "LATENCY" ? "응답 지연" : "오류 급증"} 감지`, detail: `응답 ${insight.currentResponseMs}ms · Timeout ${insight.timeoutCount}건 · 오류 ${insight.errorCount}건`, observed: scenario === "LATENCY" ? insight.currentResponseMs : insight.errorCount, threshold: scenario === "LATENCY" ? 1000 : 10, openedAt: now, lastDetectedAt: now, insight };
    db.incidents = [...(db.incidents ?? []), incident];
    db.logs = [...(db.logs ?? []), ...Array.from({ length: insight.errorCount + insight.timeoutCount }, (_, index): LogEntry => ({ id: nextId(db), agentId: agent.id, agentName: agent.name, source: "synthetic-wallpad.log", level: index < insight.timeoutCount ? "WARN" : "ERROR", message: index < insight.timeoutCount ? `[DEMO] gateway response Timeout; synthetic deadline exceeded durationMs=${insight.currentResponseMs}` : "[DEMO] copy format ERROR: invalid synthetic value; expected NN-NNNN", loggedAt: now }))];
    agent.lastSeenAt = now;
    if (db.showcase?.agents[agent.id]) db.showcase.agents[agent.id].lastTick = new Date(Date.now() - 60_000).toISOString();
    pushEvent(db, project, "INCIDENT_OPENED", "ERROR", incident.title, incident.detail);
    write(db);
    return delay(incident, 80);
  },

  async recoverDemo(projectId: number): Promise<void> {
    const db = read();
    const project = ownedProject(db, projectId);
    if (project.projectCode !== DEMO_CODE) throw new Error("시연 프로젝트만 복구할 수 있습니다.");
    const now = new Date().toISOString();
    for (const incident of (db.incidents ?? []).filter((i) => i.projectId === projectId && i.status === "OPEN")) {
      incident.status = "RESOLVED"; incident.resolvedAt = now; incident.resolvedBy = "USER";
      pushEvent(db, project, "INCIDENT_RESOLVED", "INFO", "시연 서버가 정상 응답으로 복구되었습니다", incident.title);
    }
    const agent = (db.agents ?? []).find((a) => a.projectId === projectId && a.state === "ONLINE");
    if (agent) {
      db.demoAnchors = { ...db.demoAnchors, [projectId]: now };
      agent.lastSeenAt = now;
      if (db.showcase?.agents[agent.id]) db.showcase.agents[agent.id].lastTick = new Date(Date.now() - 60_000).toISOString();
      db.logs = [...(db.logs ?? []), { id: nextId(db), agentId: agent.id, agentName: agent.name, source: "synthetic-wallpad.log", level: "INFO", message: "[DEMO] recovery complete; gateway response received durationMs=120", loggedAt: now }];
    }
    write(db);
  },

  async alertChannels(): Promise<AlertChannel[]> {
    const db = read();
    return delay((db.alertChannels ?? []).filter((c) => (c.createdBy ?? 1) === currentUserId()).map(({ url: _url, createdBy: _createdBy, ...c }) => c));
  },

  async saveAlertChannel(id: number | null, body: AlertChannelRequest): Promise<AlertChannel> {
    const db = read();
    const list = db.alertChannels ?? [];
    const url = body.webhookUrl?.trim() ?? "";
    if ((id === null || url) && !url.startsWith("https://hooks.slack.com/services/")) {
      throw new Error("Slack Incoming Webhook 주소(https://hooks.slack.com/services/...)를 입력해주세요.");
    }
    const masked = (u: string) => `https://hooks.slack.com/services/****${u.slice(-4)}`;
    let saved: AlertChannel & { url: string; createdBy?: number };
    if (id === null) {
      saved = {
        id: nextId(db),
        type: "SLACK",
        name: body.name.trim(),
        url,
        target: masked(url),
        enabled: true,
        createdAt: new Date().toISOString(),
        createdBy: currentUserId(),
      };
      list.push(saved);
    } else {
      const found = list.find((c) => c.id === id && (c.createdBy ?? 1) === currentUserId());
      if (!found) throw new Error("알림 채널을 찾을 수 없습니다.");
      found.name = body.name.trim();
      if (url) {
        found.url = url;
        found.target = masked(url);
      }
      if (body.enabled !== undefined) found.enabled = body.enabled;
      saved = found;
    }
    db.alertChannels = list;
    write(db);
    const { url: _url, ...channel } = saved;
    return delay(channel);
  },

  async deleteAlertChannel(id: number): Promise<void> {
    const db = read();
    if (!(db.alertChannels ?? []).some((c) => c.id === id && (c.createdBy ?? 1) === currentUserId())) throw new Error("알림 채널을 찾을 수 없습니다.");
    db.alertChannels = (db.alertChannels ?? []).filter((c) => c.id !== id);
    db.alertRules = (db.alertRules ?? []).filter((r) => r.channelId !== id);
    write(db);
    return delay(undefined);
  },

  async testAlertChannel(): Promise<{ success: boolean; error?: string | null }> {
    return delay({ success: false, error: "데모 모드에서는 Slack 으로 보내지 않습니다." });
  },

  async alertRules(): Promise<AlertRule[]> {
    const db = read();
    return delay((db.alertRules ?? []).filter((r) => (r.createdBy ?? 1) === currentUserId()));
  },

  async saveAlertRule(id: number | null, body: AlertRuleRequest): Promise<AlertRule> {
    const db = read();
    const channel = (db.alertChannels ?? []).find((c) => c.id === body.channelId && (c.createdBy ?? 1) === currentUserId());
    if (!channel) throw new Error("알림 채널을 찾을 수 없습니다.");
    const project = body.projectId ? ownedProject(db, body.projectId) : null;
    const list = db.alertRules ?? [];
    const base = {
      createdBy: currentUserId(),
      name: body.name.trim(),
      projectId: body.projectId ?? null,
      projectName: project?.name ?? null,
      channelId: channel.id,
      channelName: channel.name,
      minSeverity: body.minSeverity,
      rules: body.rules,
      notifyResolved: body.notifyResolved,
      quietStart: body.quietStart ?? null,
      quietEnd: body.quietEnd ?? null,
      enabled: body.enabled ?? true,
    };
    let saved: AlertRule;
    if (id === null) {
      saved = { id: nextId(db), createdAt: new Date().toISOString(), ...base };
      list.push(saved);
    } else {
      const idx = list.findIndex((r) => r.id === id && (r.createdBy ?? 1) === currentUserId());
      if (idx < 0) throw new Error("알림 규칙을 찾을 수 없습니다.");
      saved = { ...list[idx], ...base };
      list[idx] = saved;
    }
    db.alertRules = list;
    write(db);
    return delay(saved);
  },

  async deleteAlertRule(id: number): Promise<void> {
    const db = read();
    if (!(db.alertRules ?? []).some((r) => r.id === id && (r.createdBy ?? 1) === currentUserId())) throw new Error("알림 규칙을 찾을 수 없습니다.");
    db.alertRules = (db.alertRules ?? []).filter((r) => r.id !== id);
    write(db);
    return delay(undefined);
  },

  async alertDeliveries(): Promise<AlertDelivery[]> {
    const db = read();
    const channels = new Set((db.alertChannels ?? []).filter((c) => (c.createdBy ?? 1) === currentUserId()).map((c) => c.id));
    return delay((db.deliveries ?? []).filter((d) => channels.has(d.channelId)));
  },
};
