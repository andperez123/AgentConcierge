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

export interface DeviceStatus {
  hostname: string;
  uptimeSeconds: number;
  platform: string;
  arch: string;
  screen?: { width: number; height: number };
  kiosk?: boolean;
  touchTestCount?: number;
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
  apparentTemperature?: number;
  condition: string;
  icon: WeatherIcon;
  fetchedAt: string;
  unit: TempUnit;
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
