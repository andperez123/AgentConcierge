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
  GoogleAuthStatus,
  HealthResponse,
  Incident,
  LogsResponse,
  Note,
  OpenClawProject,
  OpenClawStatus,
  Operation,
  OperationResponse,
  ProjectBreakdown,
  ProjectExportResponse,
  Reminder,
  RestartEvent,
  SettingsSaveResponse,
  TempUnit,
  UpdateNoteBody,
  UpdateReminderBody,
  VoiceCommandResponse,
  Weather,
  WorkEntityActionBody,
  WorkEntityKind,
} from "@concierge/shared";

const API = "/api";

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API}/health`);
  if (!res.ok) throw new Error("API unreachable");
  return res.json();
}

export async function fetchDashboardState(
  force = false,
  mode?: "work" | "life",
): Promise<DashboardState> {
  const params = new URLSearchParams();
  if (force) params.set("force", "1");
  if (mode) params.set("mode", mode);
  const qs = params.toString();
  const res = await fetch(
    `${API}/dashboard/state${qs ? `?${qs}` : ""}`,
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

export async function runGoogleReauth(): Promise<ActionResponse> {
  const res = await fetch(`${API}/openclaw/google/reauth`, { method: "POST" });
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

export async function fetchReminders(options?: {
  status?: "active" | "completed";
  projectId?: string;
  context?: "work" | "life";
}): Promise<Reminder[]> {
  const params = new URLSearchParams();
  if (options?.status === "completed") params.set("status", "completed");
  if (options?.projectId) params.set("projectId", options.projectId);
  if (options?.context) params.set("context", options.context);
  const qs = params.toString();
  const res = await fetch(`${API}/reminders${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Reminders fetch failed");
  return res.json();
}

export async function fetchReminder(id: number): Promise<Reminder> {
  const res = await fetch(`${API}/reminders/${id}`);
  if (!res.ok) throw new Error("Reminder fetch failed");
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
    body: JSON.stringify({ ...body, source: body.source ?? "dashboard" }),
  });
  if (!res.ok) throw new Error("Failed to create reminder");
  return res.json();
}

export async function fetchNotes(options?: {
  status?: "active" | "completed";
  projectId?: string;
  context?: "work" | "life";
}): Promise<Note[]> {
  const params = new URLSearchParams();
  if (options?.status === "completed") params.set("status", "completed");
  if (options?.projectId) params.set("projectId", options.projectId);
  if (options?.context) params.set("context", options.context);
  const qs = params.toString();
  const res = await fetch(`${API}/notes${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Notes fetch failed");
  return res.json();
}

export async function fetchNote(id: number): Promise<Note> {
  const res = await fetch(`${API}/notes/${id}`);
  if (!res.ok) throw new Error("Note fetch failed");
  return res.json();
}

export async function dismissNote(id: number): Promise<void> {
  await fetch(`${API}/notes/${id}`, { method: "DELETE" });
}

export async function postVoiceCommand(
  text: string,
): Promise<VoiceCommandResponse> {
  const res = await fetch(`${API}/voice/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Voice command failed");
  }
  return data as VoiceCommandResponse;
}

export async function createNote(body: CreateNoteBody): Promise<Note> {
  const res = await fetch(`${API}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, source: body.source ?? "dashboard" }),
  });
  if (!res.ok) throw new Error("Failed to create note");
  return res.json();
}

export async function updateReminder(
  id: number,
  body: UpdateReminderBody,
): Promise<Reminder> {
  const res = await fetch(`${API}/reminders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update reminder");
  return res.json();
}

export async function updateNote(id: number, body: UpdateNoteBody): Promise<Note> {
  const res = await fetch(`${API}/notes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update note");
  return res.json();
}

export async function fetchGoogleAuthStatus(
  force = false,
): Promise<GoogleAuthStatus> {
  const res = await fetch(
    `${API}/openclaw/google/status${force ? "?force=1" : ""}`,
  );
  if (!res.ok) throw new Error("Google status fetch failed");
  return res.json();
}

export async function fetchProjects(): Promise<OpenClawProject[]> {
  const res = await fetch(`${API}/projects`);
  if (!res.ok) throw new Error("Projects fetch failed");
  return res.json();
}

export async function fetchProjectBreakdown(
  id: string,
): Promise<ProjectBreakdown> {
  const res = await fetch(`${API}/projects/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("Project not found");
  return res.json();
}

export async function exportProjectContext(
  id: string,
): Promise<ProjectExportResponse> {
  const res = await fetch(
    `${API}/projects/${encodeURIComponent(id)}/export`,
    { method: "POST" },
  );
  const body = (await res.json()) as ProjectExportResponse;
  if (!res.ok) {
    throw new Error(body.message ?? "Export failed");
  }
  return body;
}

export async function postWorkEntityAction(
  kind: WorkEntityKind,
  id: string,
  body: WorkEntityActionBody,
): Promise<OperationResponse> {
  const res = await fetch(`${API}/work/${kind}/${encodeURIComponent(id)}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Action failed");
  return res.json();
}
