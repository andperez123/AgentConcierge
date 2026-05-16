import type {
  ActionResponse,
  DeviceStatus,
  HealthResponse,
  LogsResponse,
  OpenClawStatus,
} from "@concierge/shared";

const API = "/api";

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API}/health`);
  if (!res.ok) throw new Error("API unreachable");
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
