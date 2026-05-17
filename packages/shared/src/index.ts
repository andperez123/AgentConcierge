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
}

export interface Note {
  id: number;
  text: string;
  createdAt: string;
  source?: string;
  pinned?: boolean;
}

export interface CreateReminderBody {
  text: string;
  dueAt?: string;
  source?: string;
}

export interface CreateNoteBody {
  text: string;
  source?: string;
  pinned?: boolean;
}
