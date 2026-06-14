export type OpenClawState = "online" | "degraded" | "offline";

export interface OpenClawStatus {
  state: OpenClawState;
  service: {
    running: boolean;
    unit?: string;
  };
  probe: {
    reachable: boolean;
    capability?: string;
    readProbe?: string;
  };
  readyz: "ok" | "not_ready" | "unknown";
  eventLoopDegraded?: boolean;
  lastRestartAt?: string;
  checkedAt: string;
  stale?: boolean;
  mock?: boolean;
  /** Consecutive failed HTTP probes (for diagnostics). */
  probeFailures?: number;
}

export type HealthState =
  | "healthy"
  | "degraded"
  | "blocked"
  | "action_needed"
  | "restarting"
  | "unknown";

export interface SystemHealth {
  state: HealthState;
  summary: string;
  reasons: string[];
  recommendedActions: string[];
  operatorSteps?: string[];
  autoRecoverable?: boolean;
  lastCheckedAt: string;
  stale?: boolean;
  legacyState?: OpenClawState;
}

export type OperationState =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "timed_out"
  | "canceled";

export interface Operation {
  id: string;
  type: string;
  state: OperationState;
  message?: string;
  acceptedAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface OperationResponse {
  operationId: string;
  acceptedAt: string;
  state: OperationState;
}

export type ActionPermission = "auto" | "require-confirmation" | "admin-only";

export type DashboardActionState =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "blocked";

export interface DashboardAction {
  id: string;
  label: string;
  description?: string;
  permission: ActionPermission;
  destructive?: boolean;
  enabled: boolean;
  state: DashboardActionState;
  lastRunAt?: string;
  lastResult?: string;
}

export type AlertLevel = "info" | "warning" | "error" | "critical";
export type AlertStatus = "active" | "acked" | "resolved";

export interface Alert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  source?: string;
  status: AlertStatus;
  createdAt: string;
  ackedAt?: string;
  actions?: string[];
}

export interface CreateAlertBody {
  id?: string;
  level?: AlertLevel;
  title: string;
  message: string;
  source?: string;
  actions?: string[];
}

export interface Incident {
  id: number;
  severity: string;
  source: string;
  message: string;
  createdAt: string;
  operationId?: string;
}

export interface RestartEvent {
  id: number;
  at: string;
  trigger: string;
  exitCode: number | null;
  message: string | null;
}

export interface DeviceMetric {
  label: string;
  value: string;
  level: "ok" | "warning" | "critical";
}

export interface DeviceStatus {
  hostname: string;
  uptimeSeconds: number;
  platform: string;
  arch: string;
  screen?: { width: number; height: number };
  kiosk?: boolean;
  touchTestCount?: number;
  metrics?: DeviceMetric[];
  networkOnline?: boolean;
}

export interface WidgetFreshness {
  stale: boolean;
  lastGoodAt?: string;
}

export interface GoogleAuthStatus {
  state: "connected" | "expired" | "missing" | "unknown";
  account?: string;
  scopes?: string[];
  lastCheckedAt: string;
  message?: string;
  recommendedAction?: "reauth" | "run-doctor";
}

export interface DashboardState {
  screen: { mode: string; device: string };
  openclaw: SystemHealth;
  alerts: Alert[];
  actions: DashboardAction[];
  widgets: {
    weather: WidgetFreshness & { data?: Weather | null };
    hero?: HeroDisplay | null;
    reminders: Reminder[];
    notes: Note[];
    projects: DashboardProjectWidget[];
    deskSummary: DeskSummary;
  };
  integrations?: {
    google?: GoogleAuthStatus;
  };
  device?: DeviceStatus;
  api: { ok: boolean; version: string; mock: boolean };
  checkedAt: string;
}

export type DashboardCommandType =
  | "toast"
  | "navigate"
  | "focus-alert"
  | "confirm"
  | "highlight-action";

export interface DashboardCommand {
  type: DashboardCommandType;
  level?: "info" | "warning" | "error";
  message?: string;
  route?: string;
  alertId?: string;
  actionId?: string;
  id?: string;
  title?: string;
}

export interface DiagnosticBundle {
  health: SystemHealth;
  incidents: Incident[];
  restarts: RestartEvent[];
  device?: DeviceStatus;
  logLines: string[];
  generatedAt: string;
}

export interface HealthResponse {
  ok: boolean;
  version: string;
  mock: boolean;
}

export interface LogsResponse {
  lines: string[];
  path?: string;
}

export interface ActionResponse {
  ok: boolean;
  message: string;
  at: string;
  operationId?: string;
}

export type TempUnit = "fahrenheit" | "celsius";

/** Tri-state work/life tagging. null = visible in both modes. */
export type WorkContext = "work" | "life" | null;

export interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

export interface AppSettings {
  city?: string;
  latitude?: number;
  longitude?: number;
  tempUnit?: TempUnit;
}

export interface Weather {
  city: string;
  temperature: number;
  high?: number;
  low?: number;
  apparentTemperature?: number;
  condition: string;
  icon: WeatherIcon;
  fetchedAt: string;
  unit: TempUnit;
}

export interface HeroDisplay {
  quote: string;
  subtitle?: string;
  imageUrl?: string;
  updatedAt: string;
  source?: string;
}

export interface SetHeroBody {
  quote: string;
  subtitle?: string;
  imageUrl?: string;
  source?: string;
}

export interface VoiceCommandBody {
  text: string;
}

export interface VoiceCommandResponse {
  ok: boolean;
  reply: string;
  mock?: boolean;
  at: string;
}

export type WeatherIcon =
  | "clear"
  | "partly_cloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunderstorm"
  | "unknown";

export interface SettingsSaveResponse {
  ok: boolean;
  settings: AppSettings;
  message?: string;
}

export interface Reminder {
  id: number;
  text: string;
  dueAt?: string;
  createdAt: string;
  source?: string;
  dismissedAt?: string;
  projectId?: string;
  context?: WorkContext;
}

export interface Note {
  id: number;
  text: string;
  createdAt: string;
  source?: string;
  pinned?: boolean;
  dismissedAt?: string;
  projectId?: string;
  context?: WorkContext;
}

export type DeskListStatus = "active" | "completed";

export interface DeskSummary {
  activeReminders: number;
  activeNotes: number;
  completedReminders: number;
  completedNotes: number;
}

export const KIOSK_DESK_ROUTES = {
  reminders: "/reminders",
  notes: "/notes",
  work: "/work",
  reminderDetail: (id: number) => `/reminders/${id}`,
  noteDetail: (id: number) => `/notes/${id}`,
} as const;

export function isAllowedKioskRoute(route: string): boolean {
  const trimmed = route.trim();
  if (!trimmed.startsWith("/") || trimmed.includes("://")) return false;

  try {
    const url = new URL(trimmed, "http://local");
    if (url.pathname === "/") return url.search === "";
    if (url.pathname === "/reminders") return url.search === "";
    if (/^\/reminders\/\d+$/.test(url.pathname)) return url.search === "";
    if (url.pathname === "/notes") return url.search === "";
    if (/^\/notes\/\d+$/.test(url.pathname)) return url.search === "";
    if (url.pathname === "/work") {
      return (
        url.search === "" ||
        url.search === "?tab=projects" ||
        url.search === "?tab=reminders" ||
        url.search === "?tab=notes"
      );
    }
    if (/^\/projects\/[a-z0-9-]+$/.test(url.pathname)) {
      return url.search === "";
    }
    return false;
  } catch {
    return false;
  }
}

export interface CreateReminderBody {
  text: string;
  dueAt?: string;
  source?: string;
  projectId?: string;
  context?: WorkContext;
}

export interface CreateNoteBody {
  text: string;
  source?: string;
  pinned?: boolean;
  projectId?: string;
  context?: WorkContext;
}

export interface UpdateReminderBody {
  text?: string;
  dueAt?: string | null;
  projectId?: string | null;
  context?: WorkContext;
}

export interface UpdateNoteBody {
  text?: string;
  pinned?: boolean;
  projectId?: string | null;
  context?: WorkContext;
}

export interface OpenClawProject {
  id: string;
  name: string;
  summary?: string;
  updatedAt?: string;
  path?: string;
  status?: string;
  nextFocus?: string;
  taskProgress?: ProjectTaskProgress;
}

export interface ProjectTaskProgress {
  done: number;
  total: number;
}

export interface ProjectOverviewSection {
  title: string;
  body: string;
}

export interface ProjectOverview {
  status?: string;
  sections: ProjectOverviewSection[];
  nextFocus?: string;
}

export interface ProjectTask {
  id: string;
  text: string;
  done: boolean;
  group?: string;
}

export interface ProjectBreakdownSection {
  title: string;
  items: Array<{ label: string; detail?: string }>;
}

export interface ProjectBreakdown {
  project: OpenClawProject;
  sections: ProjectBreakdownSection[];
  linkedReminders: Reminder[];
  linkedNotes: Note[];
  overview?: ProjectOverview;
  tasks?: ProjectTask[];
  taskProgress?: ProjectTaskProgress;
}

export interface DashboardProjectWidget {
  id: string;
  name: string;
  status?: string;
  nextFocus?: string;
  taskProgress?: ProjectTaskProgress;
}

export interface SyncProjectBody {
  id: string;
  name?: string;
  summary?: string;
  breakdown?: ProjectBreakdownSection[];
}

export type WorkEntityKind = "reminder" | "note" | "project";

export type WorkEntityActionId =
  | "ask-agent"
  | "export-drive"
  | "summarize"
  | "complete";

export interface WorkEntityActionBody {
  action: WorkEntityActionId;
  options?: { folder?: string; prompt?: string };
}

export interface ProjectExportResponse {
  ok: boolean;
  path?: string;
  filename?: string;
  message?: string;
}

export { formatProjectBreakdownMarkdown } from "./formatProjectMarkdown.js";
