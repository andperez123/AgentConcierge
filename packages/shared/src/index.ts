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

export interface AppSettings {
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface Weather {
  city: string;
  temperature: number;
  apparentTemperature?: number;
  condition: string;
  icon: WeatherIcon;
  fetchedAt: string;
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
