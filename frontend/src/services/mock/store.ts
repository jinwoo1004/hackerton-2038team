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
  EventLevel,
  EventPage,
  EventSummary,
  EventType,
  Incident,
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

const KEY = "mp.mockdb";

interface MockUser extends User {
  password: string;
}

interface MockDb {
  seq: number;
  users: MockUser[];
  projects: Project[];
  files: ProjectFile[];
  analyses: Analysis[];
  events?: ActivityEvent[];
  agents?: Agent[];
  alertChannels?: (AlertChannel & { url: string })[];
  alertRules?: AlertRule[];
  deliveries?: AlertDelivery[];
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
  const raw = window.localStorage.getItem(KEY);
  if (!raw) {
    const db = emptyDb();
    window.localStorage.setItem(KEY, JSON.stringify(db));
    return db;
  }
  try {
    return JSON.parse(raw) as MockDb;
  } catch {
    const db = emptyDb();
    window.localStorage.setItem(KEY, JSON.stringify(db));
    return db;
  }
}

function write(db: MockDb) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(db));
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

// 목 모드는 실제 분석을 못 해서 몇 초 뒤 완료로 바꾼다
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
    a.summary = "데모 모드에서는 실제 분석이 실행되지 않습니다.\n백엔드와 분석 서비스를 연결하면 소스와 로그를 분석한 결과가 표시됩니다.";
    a.score = 100;
    a.grade = "A";
    a.criticalCount = 0;
    a.warningCount = 0;
    a.infoCount = 0;
    a.result = {
      overview: { score: 100, grade: "A", critical: 0, warning: 0, info: 0 },
      source: { available: false },
      categories: [],
      findings: [],
      rules: { documents: [], forbidden: [], limits: { fileLines: 1000, functionLines: 100, lineLength: 160 }, customLimits: [] },
      logs: { available: false },
      notes: ["데모 모드 결과입니다. NEXT_PUBLIC_API_BASE_URL 을 설정하면 실제 분석 결과를 볼 수 있습니다."],
    };
    const p = db.projects.find((x) => x.id === a.projectId);
    if (p) {
      p.status = "ACTIVE";
      p.lastAnalyzedAt = a.completedAt;
    }
    pushEvent(db, p, "ANALYSIS_COMPLETED", "INFO", "분석이 완료되었습니다", "데모 모드 결과");
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
    const withCounts = db.projects.map((p) => ({
      ...p,
      fileCount: db.files.filter((f) => f.projectId === p.id).length,
    }));
    return delay(withCounts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  async getProject(id: number): Promise<Project> {
    const db = read();
    const project = db.projects.find((p) => p.id === id);
    if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
    return delay({ ...project, fileCount: db.files.filter((f) => f.projectId === id).length });
  },

  async createProject(body: ProjectCreateRequest): Promise<Project> {
    const db = read();
    if (db.projects.some((p) => p.projectCode.toUpperCase() === body.projectCode.toUpperCase())) {
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
    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error("프로젝트를 찾을 수 없습니다.");
    db.projects[idx] = { ...db.projects[idx], ...body, updatedAt: new Date().toISOString() };
    write(db);
    return delay(db.projects[idx]);
  },

  async deleteProject(id: number): Promise<void> {
    const db = read();
    pushEvent(db, db.projects.find((p) => p.id === id), "PROJECT_DELETED", "WARNING", "프로젝트를 삭제했습니다");
    db.projects = db.projects.filter((p) => p.id !== id);
    db.agents = (db.agents ?? []).filter((a) => a.projectId !== id);
    db.alertRules = (db.alertRules ?? []).filter((r) => r.projectId !== id);
    db.files = db.files.filter((f) => f.projectId !== id);
    db.analyses = db.analyses.filter((a) => a.projectId !== id);
    write(db);
    return delay(undefined);
  },

  async checkCode(code: string): Promise<boolean> {
    const db = read();
    return delay(!db.projects.some((p) => p.projectCode.toUpperCase() === code.toUpperCase()), 260);
  },

  async listFiles(projectId: number): Promise<ProjectFile[]> {
    const db = read();
    return delay(db.files.filter((f) => f.projectId === projectId));
  },

  async addFile(projectId: number, file: File, fileType: ProjectFileType): Promise<ProjectFile> {
    const db = read();
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
    pushEvent(db, db.projects.find((p) => p.id === projectId), "FILE_UPLOADED", "INFO", "파일을 올렸습니다", file.name);
    write(db);
    return delay(saved, 200);
  },

  async deleteFile(fileId: number): Promise<void> {
    const db = read();
    const target = db.files.find((f) => f.id === fileId);
    if (target) {
      pushEvent(db, db.projects.find((p) => p.id === target.projectId), "FILE_DELETED", "INFO", "파일을 삭제했습니다", target.originalFilename);
    }
    db.files = db.files.filter((f) => f.id !== fileId);
    write(db);
    return delay(undefined, 150);
  },

  async startAnalysis(projectId: number): Promise<Analysis> {
    const db = read();
    const now = new Date().toISOString();
    const analysis: Analysis = {
      id: nextId(db),
      projectId,
      status: "QUEUED",
      startedAt: now,
      completedAt: null,
      summary: null,
      createdAt: now,
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
    const list = db.analyses.filter((a) => a.projectId === projectId);
    return delay(list.length ? list[list.length - 1] : null, 200);
  },

  async analysis(projectId: number, analysisId: number): Promise<Analysis> {
    const db = settleAnalyses(read());
    const found = db.analyses.find((a) => a.id === analysisId && a.projectId === projectId);
    if (!found) throw new Error("분석을 찾을 수 없습니다.");
    return delay(found, 200);
  },

  async analysisHistory(projectId: number): Promise<Analysis[]> {
    const db = settleAnalyses(read());
    return delay(db.analyses.filter((a) => a.projectId === projectId).reverse());
  },

  async allAnalyses(): Promise<AnalysisListItem[]> {
    const db = settleAnalyses(read());
    const items = db.analyses
      .slice()
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
    const db = settleAnalyses(read());
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
      recentEvents: (db.events ?? []).slice(0, 8),
    });
  },

  async systemStatus(): Promise<SystemStatus> {
    return delay({
      services: [
        { key: "api", name: "백엔드 API", status: "MOCK", detail: "브라우저 데모 모드", latencyMs: null },
        { key: "db", name: "데이터베이스", status: "MOCK", detail: "로컬스토리지", latencyMs: null },
        { key: "analysis", name: "분석 서비스", status: "DISABLED", detail: "데모 모드에서는 연결하지 않습니다", latencyMs: null },
        {
          key: "agent",
          name: "수집 에이전트",
          status: "NOT_CONNECTED",
          detail: (read().agents ?? []).length ? "데모 모드에서는 에이전트가 연결되지 않습니다" : "등록된 에이전트가 없습니다",
          latencyMs: null,
        },
      ],
      checkedAt: new Date().toISOString(),
    });
  },

  async events(params: EventFilter & { level?: EventLevel; sort?: "asc" | "desc"; page?: number; size?: number }): Promise<EventPage> {
    const db = settleAnalyses(read());
    const size = params.size ?? 30;
    const page = params.page ?? 0;
    const all = filterEvents(db.events ?? [], params).filter((e) => !params.level || e.level === params.level);
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
    const list = filterEvents(db.events ?? [], params);
    const scoped = (db.events ?? []).filter((e) => !params.projectId || e.projectId === params.projectId);
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
    return delay((db.agents ?? []).filter((a) => a.projectId === projectId));
  },

  async createAgent(projectId: number, name: string): Promise<AgentCreated> {
    const db = read();
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
    const target = (db.agents ?? []).find((a) => a.id === agentId);
    db.agents = (db.agents ?? []).filter((a) => a.id !== agentId);
    if (target) {
      pushEvent(db, db.projects.find((p) => p.id === projectId), "AGENT_DELETED", "WARNING", "에이전트를 삭제했습니다", target.name);
    }
    write(db);
    return delay(undefined);
  },

  async logEntries(): Promise<LogEntry[]> {
    return delay([], 200);
  },

  async metrics(minutes: number): Promise<MetricSeriesResponse> {
    return delay({ minutes, bucketSeconds: 60, series: [] }, 200);
  },

  async monitoringOverview(): Promise<MonitoringOverview> {
    const db = read();
    const agents = db.agents ?? [];
    return delay({
      agentsTotal: agents.length,
      agentsOnline: 0,
      errors1h: 0,
      openIncidents: 0,
      projects: db.projects.map((p) => ({
        projectId: p.id,
        name: p.name,
        projectCode: p.projectCode,
        agents: agents.filter((a) => a.projectId === p.id),
        logs1h: { error: 0, warn: 0, total: 0 },
        openIncidents: 0,
      })),
      checkedAt: new Date().toISOString(),
    });
  },

  async incidents(): Promise<Incident[]> {
    return delay([], 200);
  },

  async resolveIncident(_id: number): Promise<Incident> {
    throw new Error("데모 모드에는 이상 기록이 없습니다.");
  },

  async alertChannels(): Promise<AlertChannel[]> {
    const db = read();
    return delay((db.alertChannels ?? []).map(({ url: _url, ...c }) => c));
  },

  async saveAlertChannel(id: number | null, body: AlertChannelRequest): Promise<AlertChannel> {
    const db = read();
    const list = db.alertChannels ?? [];
    const url = body.webhookUrl?.trim() ?? "";
    if ((id === null || url) && !url.startsWith("https://hooks.slack.com/services/")) {
      throw new Error("Slack Incoming Webhook 주소(https://hooks.slack.com/services/...)를 입력해주세요.");
    }
    const masked = (u: string) => `https://hooks.slack.com/services/****${u.slice(-4)}`;
    let saved: AlertChannel & { url: string };
    if (id === null) {
      saved = {
        id: nextId(db),
        type: "SLACK",
        name: body.name.trim(),
        url,
        target: masked(url),
        enabled: true,
        createdAt: new Date().toISOString(),
      };
      list.push(saved);
    } else {
      const found = list.find((c) => c.id === id);
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
    return delay(db.alertRules ?? []);
  },

  async saveAlertRule(id: number | null, body: AlertRuleRequest): Promise<AlertRule> {
    const db = read();
    const channel = (db.alertChannels ?? []).find((c) => c.id === body.channelId);
    if (!channel) throw new Error("알림 채널을 찾을 수 없습니다.");
    const project = body.projectId ? db.projects.find((p) => p.id === body.projectId) : null;
    const list = db.alertRules ?? [];
    const base = {
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
      const idx = list.findIndex((r) => r.id === id);
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
    db.alertRules = (db.alertRules ?? []).filter((r) => r.id !== id);
    write(db);
    return delay(undefined);
  },

  async alertDeliveries(): Promise<AlertDelivery[]> {
    return delay(read().deliveries ?? []);
  },
};
