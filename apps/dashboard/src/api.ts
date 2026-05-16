import type {
  ActionResponse,
  Alert,
  AppSettings,
  CreateAlertBody,
  CreateNoteBody,
  CreateReminderBody,
  DashboardCommand,
  DashboardState,
  DeviceStatus,
  DiagnosticBundle,
  GeocodeResult,
  HealthResponse,
  Incident,
  LogsResponse,
  Note,
  OpenClawStatus,
  Operation,
  OperationResponse,
  Reminder,
  RestartEvent,
  SettingsSaveResponse,
  TempUnit,
  Weather,
} from "@concierge/shared";

const API = "/api";

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API}/health`);
  if (!res.ok) throw new Error("API unreachable");
  return res.json();
}

export async function fetchDashboardState(
  force = false,
): Promise<DashboardState> {
  const res = await fetch(
    `${API}/dashboard/state${force ? "?force=1" : ""}`,
  );
  if (!res.ok) throw new Error("Dashboard state fetch failed");
  return res.json();
}

export async function fetchOperation(id: string): Promise<Operation> {
  const res = await fetch(`${API}/operations/${id}`);
  if (!res.ok) throw new Error("Operation not found");
  return res.json();
}

export async function postDashboardAction(
  actionId: string,
  body?: Record<string, unknown>,
): Promise<OperationResponse> {
  const res = await fetch(`${API}/dashboard/actions/${actionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

export async function postDashboardCommand(
  cmd: DashboardCommand,
): Promise<{ ok: boolean; id: string }> {
  const res = await fetch(`${API}/dashboard/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error("Command failed");
  return res.json();
}

export async function fetchAlerts(): Promise<Alert[]> {
  const res = await fetch(`${API}/alerts`);
  return res.json();
}

export async function ackAlert(id: string): Promise<void> {
  await fetch(`${API}/alerts/${id}/ack`, { method: "POST" });
}

export async function createAlert(body: CreateAlertBody): Promise<Alert> {
  const res = await fetch(`${API}/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to create alert");
  return res.json();
}

export async function fetchIncidents(opts?: {
  limit?: number;
  severity?: string;
}): Promise<Incident[]> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.severity) params.set("severity", opts.severity);
  const res = await fetch(`${API}/events/incidents?${params}`);
  return res.json();
}

export async function fetchRestarts(): Promise<RestartEvent[]> {
  const res = await fetch(`${API}/openclaw/restarts`);
  return res.json();
}

export async function fetchDiagnosticBundle(): Promise<DiagnosticBundle> {
  const res = await fetch(`${API}/logs/diagnostic-bundle`);
  if (!res.ok) throw new Error("Diagnostic fetch failed");
  return res.json();
}

export async function fetchOpenClawStatus(
  force = false,
): Promise<OpenClawStatus> {
  const res = await fetch(
    `${API}/openclaw/status${force ? "?force=1" : ""}`,
  );
  if (!res.ok) throw new Error("Status fetch failed");
  return res.json();
}

export async function restartGateway(force = false): Promise<ActionResponse> {
  const res = await fetch(`${API}/openclaw/restart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  });
  return res.json();
}

export async function runDoctor(): Promise<ActionResponse> {
  const res = await fetch(`${API}/openclaw/doctor`, { method: "POST" });
  return res.json();
}

export async function runReauth(): Promise<ActionResponse> {
  const res = await fetch(`${API}/openclaw/reauth`, { method: "POST" });
  return res.json();
}

export async function fetchLogs(lines = 200): Promise<LogsResponse> {
  const res = await fetch(`${API}/openclaw/logs?lines=${lines}`);
  if (!res.ok) throw new Error("Logs fetch failed");
  return res.json();
}

export async function fetchDeviceStatus(): Promise<DeviceStatus> {
  const res = await fetch(`${API}/device/status`);
  return res.json();
}

export async function reportScreen(
  width: number,
  height: number,
  kiosk: boolean,
): Promise<void> {
  await fetch(`${API}/device/screen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ width, height, kiosk }),
  });
}

export async function touchTest(): Promise<{ count: number }> {
  const res = await fetch(`${API}/device/touch-test`, { method: "POST" });
  return res.json();
}

export async function fetchWeather(force = false): Promise<Weather> {
  const res = await fetch(`${API}/weather${force ? "?force=1" : ""}`);
  if (res.status === 404) throw new Error("NO_CITY");
  if (!res.ok) throw new Error("Weather fetch failed");
  return res.json();
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch(`${API}/settings`);
  if (!res.ok) throw new Error("Settings fetch failed");
  return res.json();
}

export async function searchGeocode(q: string): Promise<GeocodeResult[]> {
  const res = await fetch(`${API}/geocode?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Geocode search failed");
  return res.json();
}

export async function saveSettings(opts: {
  query?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  tempUnit?: TempUnit;
}): Promise<SettingsSaveResponse> {
  const res = await fetch(`${API}/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const data = await res.json();
  if (!res.ok) {
    return {
      ok: false,
      settings: {},
      message: data.message ?? "Save failed",
    };
  }
  return data;
}

export async function fetchReminders(): Promise<Reminder[]> {
  const res = await fetch(`${API}/reminders`);
  if (!res.ok) throw new Error("Reminders fetch failed");
  return res.json();
}

export async function dismissReminder(id: number): Promise<void> {
  await fetch(`${API}/reminders/${id}`, { method: "DELETE" });
}

export async function createReminder(
  body: CreateReminderBody,
): Promise<Reminder> {
  const res = await fetch(`${API}/reminders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to create reminder");
  return res.json();
}

export async function fetchNotes(): Promise<Note[]> {
  const res = await fetch(`${API}/notes`);
  if (!res.ok) throw new Error("Notes fetch failed");
  return res.json();
}

export async function dismissNote(id: number): Promise<void> {
  await fetch(`${API}/notes/${id}`, { method: "DELETE" });
}

export async function createNote(body: CreateNoteBody): Promise<Note> {
  const res = await fetch(`${API}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to create note");
  return res.json();
}
