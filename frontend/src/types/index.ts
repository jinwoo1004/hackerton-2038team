export interface User {
  id: number;
  email: string;
  name: string;
  company?: string | null;
  department?: string | null;
  role: "ADMIN" | "USER";
  createdAt: string;
}

export type ProjectStatus = "READY" | "ANALYZING" | "ACTIVE" | "ERROR";

export type TechCategory = "LANGUAGE" | "FRAMEWORK" | "DATABASE" | "INFRASTRUCTURE";

export interface ProjectTechnology {
  id?: number;
  category: TechCategory;
  name: string;
}

export type ProjectFileType = "RULE" | "SOURCE" | "LOG" | "ETC";

export interface ProjectFile {
  id: number;
  projectId: number;
  fileType: ProjectFileType;
  originalFilename: string;
  storedFilename?: string;
  filePath?: string;
  fileSize: number;
  mimeType?: string | null;
  createdAt: string;
}

export interface Project {
  id: number;
  projectCode: string;
  name: string;
  nickname?: string | null;
  description?: string | null;
  status: ProjectStatus;
  technologies: ProjectTechnology[];
  fileCount: number;
  lastAnalyzedAt?: string | null;
  recentEventCount?: number;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
}

export type AnalysisStatus = "READY" | "QUEUED" | "ANALYZING" | "COMPLETED" | "FAILED";

export interface Analysis {
  id: number;
  projectId: number;
  status: AnalysisStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  summary?: string | null;
  createdAt: string;
  score?: number | null;
  grade?: string | null;
  criticalCount?: number | null;
  warningCount?: number | null;
  infoCount?: number | null;
  result?: AnalysisResult | null;
}

export type EventLevel = "INFO" | "WARNING" | "ERROR";

export type EventType =
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "PROJECT_DELETED"
  | "FILE_UPLOADED"
  | "FILE_DELETED"
  | "ANALYSIS_STARTED"
  | "ANALYSIS_COMPLETED"
  | "ANALYSIS_FAILED"
  | "AGENT_REGISTERED"
  | "AGENT_DELETED"
  | "AGENT_CONNECTED"
  | "AGENT_DISCONNECTED"
  | "INCIDENT_OPENED"
  | "INCIDENT_RESOLVED"
  | "ALERT_SENT"
  | "ALERT_FAILED";

export interface ActivityEvent {
  id: number;
  projectId?: number | null;
  projectName?: string | null;
  type: EventType;
  level: EventLevel;
  title: string;
  message?: string | null;
  createdAt: string;
}

export interface EventSummary {
  total: number;
  error: number;
  warning: number;
  info: number;
  last24h: number;
  prev24h: number;
}

export interface EventPage {
  items: ActivityEvent[];
  page: number;
  size: number;
  total: number;
  hasNext: boolean;
}

export interface ProjectHealth {
  projectId: number;
  name: string;
  projectCode: string;
  status: ProjectStatus;
  lastAnalyzedAt?: string | null;
  latestStatus?: AnalysisStatus | null;
  score?: number | null;
  grade?: string | null;
  critical?: number | null;
  warning?: number | null;
  info?: number | null;
}

export interface Dashboard {
  health?: HealthSummary;
  incidentTrend?: IncidentTrend[];
  projects: { total: number; ready: number; analyzing: number; active: number; error: number };
  fileCount: number;
  analyses: { total: number; running: number; completed: number; failed: number; averageScore?: number | null };
  severity: { critical: number; warning: number; info: number };
  projectHealth: ProjectHealth[];
  recentEvents: ActivityEvent[];
}

export interface AnalysisListItem {
  id: number;
  projectId: number;
  projectName: string;
  projectCode: string;
  status: AnalysisStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  score?: number | null;
  grade?: string | null;
  critical?: number | null;
  warning?: number | null;
  info?: number | null;
  summary?: string | null;
}

export type ServiceState = "UP" | "DOWN" | "DEGRADED" | "DISABLED" | "NOT_CONNECTED" | "MOCK";

export interface ServiceStatus {
  key: string;
  name: string;
  status: ServiceState;
  detail?: string | null;
  latencyMs?: number | null;
}

export interface SystemStatus {
  services: ServiceStatus[];
  checkedAt: string;
}

export interface ProfileUpdateRequest {
  name: string;
  company?: string;
  department?: string;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export type AgentState = "PENDING" | "ONLINE" | "OFFLINE";

export interface MetricSnapshot {
  collectedAt: string;
  cpuPct?: number | null;
  memoryPct?: number | null;
  diskPct?: number | null;
  netInKbps?: number | null;
  netOutKbps?: number | null;
}

export interface Agent {
  id: number;
  projectId: number;
  name: string;
  tokenPrefix: string;
  hostname?: string | null;
  os?: string | null;
  agentVersion?: string | null;
  ipAddress?: string | null;
  state: AgentState;
  lastSeenAt?: string | null;
  createdAt: string;
  latest?: MetricSnapshot | null;
}

export interface AgentCreated {
  agent: Agent;
  token: string;
}

export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL" | "UNKNOWN";

export interface LogEntry {
  id: number;
  agentId: number;
  agentName?: string | null;
  source?: string | null;
  level: LogLevel;
  message: string;
  loggedAt: string;
}

export interface MetricBucket {
  time: string;
  cpuPct?: number | null;
  memoryPct?: number | null;
  diskPct?: number | null;
  netInKbps?: number | null;
  netOutKbps?: number | null;
}

export interface MetricSeries {
  agentId: number;
  agentName: string;
  points: MetricBucket[];
}

export interface MetricSeriesResponse {
  minutes: number;
  bucketSeconds: number;
  series: MetricSeries[];
}

export interface ProjectMonitoring {
  projectId: number;
  name: string;
  projectCode: string;
  agents: Agent[];
  logs1h: { error: number; warn: number; total: number };
  openIncidents: number;
}

export interface MonitoringOverview {
  health?: HealthSummary;
  incidentTrend?: IncidentTrend[];
  agentsTotal: number;
  agentsOnline: number;
  errors1h: number;
  openIncidents: number;
  projects: ProjectMonitoring[];
  checkedAt: string;
}

export type IncidentRule =
  | "LATENCY"
  | "AGENT_DOWN"
  | "CPU_HIGH"
  | "MEMORY_HIGH"
  | "DISK_HIGH"
  | "ERROR_BURST"
  | "FATAL_LOG"
  | "NEW_ERROR"
  | "ERROR_SPIKE"
  | "CPU_SPIKE";

export type IncidentSeverity = "WARNING" | "CRITICAL";
export type IncidentStatus = "OPEN" | "RESOLVED";

export interface Incident {
  insight?: IncidentInsight | null;
  id: number;
  projectId: number;
  projectName?: string | null;
  projectCode?: string | null;
  agentId?: number | null;
  agentName?: string | null;
  rule: IncidentRule;
  ruleLabel: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  detail?: string | null;
  observed?: number | null;
  threshold?: number | null;
  openedAt: string;
  lastDetectedAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

export interface HealthSummary { total: number; normal: number; warning: number; critical: number; openIncidents: number }
export interface IncidentTrend { date: string; opened: number; resolved: number }

export interface IncidentInsight {
  source: "OPENAI" | "LOCAL";
  serverName: string;
  baselineResponseMs: number | null;
  currentResponseMs: number | null;
  timeoutCount: number;
  errorCount: number;
  severity: IncidentSeverity;
  summary: string;
  evidence: string[];
  causes: string[];
  actions: string[];
}

export interface SlackPreview {
  message: string;
  externalDelivery: boolean;
}

export interface DemoSeed {
  projectId: number;
  agentId: number;
  analysisId: number;
}

export type AlertChannelType = "SLACK";

export interface AlertChannel {
  id: number;
  type: AlertChannelType;
  name: string;
  target: string;
  enabled: boolean;
  lastSentAt?: string | null;
  lastError?: string | null;
  createdAt: string;
}

export interface AlertChannelRequest {
  name: string;
  type?: AlertChannelType;
  webhookUrl?: string;
  enabled?: boolean;
}

export interface AlertRule {
  id: number;
  name: string;
  projectId?: number | null;
  projectName?: string | null;
  channelId: number;
  channelName?: string | null;
  minSeverity: IncidentSeverity;
  rules: IncidentRule[];
  notifyResolved: boolean;
  quietStart?: string | null;
  quietEnd?: string | null;
  enabled: boolean;
  createdAt: string;
}

export interface AlertRuleRequest {
  name: string;
  projectId?: number | null;
  channelId: number;
  minSeverity: IncidentSeverity;
  rules: IncidentRule[];
  notifyResolved: boolean;
  quietStart?: string | null;
  quietEnd?: string | null;
  enabled?: boolean;
}

export type DeliveryKind = "OPENED" | "ESCALATED" | "RESOLVED" | "TEST";

export interface AlertDelivery {
  id: number;
  channelId: number;
  channelName: string;
  incidentId?: number | null;
  projectId?: number | null;
  kind: DeliveryKind;
  title: string;
  success: boolean;
  error?: string | null;
  sentAt: string;
}

export type Severity = "CRITICAL" | "WARNING" | "INFO";

export type FindingCategory = "quality" | "errors" | "security" | "performance" | "rules" | "logs";

export interface AnalysisFinding {
  ruleSource?: string | null;
  ruleText?: string | null;
  ruleId: string;
  category: FindingCategory;
  severity: Severity;
  title: string;
  message: string;
  file?: string | null;
  line?: number | null;
  snippet?: string | null;
  recommendation?: string | null;
}

export interface CategorySummary {
  key: FindingCategory;
  label: string;
  count: number;
  critical: number;
  warning: number;
  info: number;
}

export interface SourceStats {
  available: boolean;
  analyzedFiles?: number;
  configFiles?: number;
  skippedFiles?: number;
  totalLines?: number;
  codeLines?: number;
  commentLines?: number;
  blankLines?: number;
  functions?: number;
  languages?: { name: string; files: number; lines: number; ratio: number }[];
  largestFiles?: { path: string; lines: number }[];
  longFunctions?: { file: string; name: string; line: number; lines: number }[];
}

export interface LogStats {
  available: boolean;
  files?: number;
  lines?: number;
  levels?: Record<"FATAL" | "ERROR" | "WARN" | "INFO" | "DEBUG", number>;
  topErrors?: { level: string; message: string; count: number; sample: string }[];
  exceptions?: { name: string; count: number }[];
  timeline?: { bucket: string; error: number; warn: number; total: number }[];
}

export interface RuleStats {
  extractionSource?: "LOCAL" | "OPENAI";
  documents: { name: string; parsed: boolean; ruleCount: number; note?: string | null }[];
  forbidden: string[];
  limits: { fileLines: number; functionLines: number; lineLength: number };
  customLimits: { type: string; value: number; source: string; text: string }[];
}

export interface AnalysisResult {
  overview: { score: number; grade: string; critical: number; warning: number; info: number };
  source: SourceStats;
  categories: CategorySummary[];
  findings: AnalysisFinding[];
  truncated?: boolean;
  rules: RuleStats;
  logs: LogStats;
  notes: string[];
  analyzedAt?: string;
}

export interface ProjectCreateRequest {
  name: string;
  nickname?: string;
  projectCode: string;
  description?: string;
  technologies: ProjectTechnology[];
}

export type ProjectUpdateRequest = Partial<ProjectCreateRequest> & { status?: ProjectStatus };

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  company?: string;
  department?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CodeCheckResponse {
  available: boolean;
}
