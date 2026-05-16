import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { OpenClawState, OpenClawStatus } from "@concierge/shared";
import {
  MOCK_OPENCLAW,
  OPENCLAW_BIN,
  OPENCLAW_GATEWAY_PORT,
  STATUS_CACHE_MS,
} from "../config.js";
import { getLastRestartAt } from "../db.js";

const execFileAsync = promisify(execFile);

let cachedStatus: OpenClawStatus | null = null;
let cachedAt = 0;
let mockOnline = true;

function readGatewayPort(): number {
  try {
    const configPath = join(homedir(), ".openclaw", "openclaw.json");
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as {
      gateway?: { port?: number };
    };
    return parsed.gateway?.port ?? OPENCLAW_GATEWAY_PORT;
  } catch {
    return OPENCLAW_GATEWAY_PORT;
  }
}

async function runOpenClaw(
  args: string[],
  timeoutMs = 12000,
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(OPENCLAW_BIN, args, {
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      env: process.env,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), code: 0 };
  } catch (err: unknown) {
    const e = err as {
      stdout?: string;
      stderr?: string;
      code?: number;
      message?: string;
    };
    return {
      stdout: (e.stdout ?? "").toString().trim(),
      stderr: (e.stderr ?? e.message ?? "").toString().trim(),
      code: typeof e.code === "number" ? e.code : 1,
    };
  }
}

async function fetchHealthz(port: number): Promise<"ok" | "not_ready" | "unknown"> {
  try {
    const readyRes = await fetch(`http://127.0.0.1:${port}/readyz`, {
      signal: AbortSignal.timeout(3000),
    });
    if (readyRes.ok) return "ok";
    const healthRes = await fetch(`http://127.0.0.1:${port}/healthz`, {
      signal: AbortSignal.timeout(3000),
    });
    return healthRes.ok ? "not_ready" : "unknown";
  } catch {
    return "unknown";
  }
}

function mapState(
  serviceRunning: boolean,
  reachable: boolean,
  readyz: OpenClawStatus["readyz"],
  degraded?: boolean,
): OpenClawState {
  if (!serviceRunning && !reachable) return "offline";
  if (degraded || readyz === "not_ready") return "degraded";
  if (reachable && readyz === "ok") return "online";
  if (reachable) return "degraded";
  return "offline";
}

function parseGatewayStatusJson(raw: string): Partial<OpenClawStatus> {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const service = (data.service ?? data.systemd ?? {}) as Record<
      string,
      unknown
    >;
    const probe = (data.probe ?? data.rpc ?? data.connectivity ?? {}) as Record<
      string,
      unknown
    >;

    const serviceRunning =
      service.running === true ||
      service.active === true ||
      data.running === true;

    const reachable =
      probe.reachable === true ||
      probe.connect === "ok" ||
      data.reachable === true;

    const capability =
      (probe.capability as string) ??
      (probe.auth as string) ??
      undefined;

    const readProbe =
      (probe.readProbe as string) ?? (probe.read as string) ?? undefined;

    const readyzRaw = data.readyz ?? data.ready;
    let readyz: OpenClawStatus["readyz"] = "unknown";
    if (readyzRaw === true || readyzRaw === "ok") readyz = "ok";
    else if (readyzRaw === false || readyzRaw === "not_ready") {
      readyz = "not_ready";
    }

    const eventLoop = data.eventLoop as Record<string, unknown> | undefined;
    const eventLoopDegraded = eventLoop?.degraded === true;

    return {
      service: {
        running: Boolean(serviceRunning),
        unit: (service.unit as string) ?? (service.name as string),
      },
      probe: { reachable: Boolean(reachable), capability, readProbe },
      readyz,
      eventLoopDegraded,
    };
  } catch {
    return {};
  }
}

function mockStatus(): OpenClawStatus {
  const state: OpenClawState = mockOnline ? "online" : "degraded";
  return {
    state,
    service: { running: mockOnline, unit: "openclaw-gateway.service (mock)" },
    probe: {
      reachable: mockOnline,
      capability: "admin-capable",
      readProbe: "ok",
    },
    readyz: mockOnline ? "ok" : "not_ready",
    lastRestartAt: getLastRestartAt(),
    checkedAt: new Date().toISOString(),
    mock: true,
  };
}

export async function getOpenClawStatus(
  force = false,
): Promise<OpenClawStatus> {
  const now = Date.now();
  if (
    !force &&
    cachedStatus &&
    now - cachedAt < STATUS_CACHE_MS
  ) {
    return { ...cachedStatus, stale: now - cachedAt > STATUS_CACHE_MS * 2 };
  }

  if (MOCK_OPENCLAW) {
    cachedStatus = mockStatus();
    cachedAt = now;
    return cachedStatus;
  }

  const port = readGatewayPort();
  const checkedAt = new Date().toISOString();

  const { stdout, code } = await runOpenClaw([
    "gateway",
    "status",
    "--json",
    "--deep",
  ]);

  let parsed: Partial<OpenClawStatus> = {};
  if (stdout) {
    parsed = parseGatewayStatusJson(stdout);
  }

  if (!parsed.probe?.reachable && code !== 0) {
    const readyz = await fetchHealthz(port);
    parsed = {
      ...parsed,
      readyz: readyz === "ok" ? "ok" : readyz,
      probe: { reachable: readyz !== "unknown", ...parsed.probe },
      service: { running: readyz !== "unknown", ...parsed.service },
    };
  } else if (parsed.readyz === "unknown") {
    parsed.readyz = await fetchHealthz(port);
  }

  const serviceRunning = parsed.service?.running ?? false;
  const reachable = parsed.probe?.reachable ?? false;
  const readyz = parsed.readyz ?? "unknown";

  const status: OpenClawStatus = {
    state: mapState(
      serviceRunning,
      reachable,
      readyz,
      parsed.eventLoopDegraded,
    ),
    service: parsed.service ?? { running: false },
    probe: parsed.probe ?? { reachable: false },
    readyz,
    eventLoopDegraded: parsed.eventLoopDegraded,
    lastRestartAt: getLastRestartAt(),
    checkedAt,
  };

  cachedStatus = status;
  cachedAt = now;
  return status;
}

export async function restartGateway(
  force = false,
): Promise<{ ok: boolean; message: string }> {
  if (MOCK_OPENCLAW) {
    mockOnline = false;
    setTimeout(() => {
      mockOnline = true;
    }, 2000);
    return { ok: true, message: "Mock gateway restart simulated" };
  }

  const args = force
    ? ["gateway", "restart", "--force", "--json"]
    : ["gateway", "restart", "--safe", "--json"];

  const { stdout, stderr, code } = await runOpenClaw(args, 60000);
  cachedStatus = null;
  const message = stdout || stderr || (code === 0 ? "Restarted" : "Restart failed");
  return { ok: code === 0, message };
}

export async function runDoctor(): Promise<{ ok: boolean; message: string }> {
  if (MOCK_OPENCLAW) {
    return { ok: true, message: "Mock doctor: all checks passed" };
  }

  const { stdout, stderr, code } = await runOpenClaw(
    ["doctor", "--non-interactive", "--json"],
    120000,
  );
  const message = stdout || stderr || "Doctor completed";
  return { ok: code === 0, message: message.slice(0, 8000) };
}

export async function getLogs(lineCount = 200): Promise<{
  lines: string[];
  path?: string;
}> {
  if (MOCK_OPENCLAW) {
    const now = new Date().toISOString();
    return {
      lines: Array.from({ length: Math.min(lineCount, 20) }, (_, i) =>
        `[mock] ${now} gateway log line ${i + 1}`,
      ),
      path: "~/.openclaw/logs/gateway.log (mock)",
    };
  }

  const logDir = join(homedir(), ".openclaw", "logs");
  const candidates = [
    join(logDir, "gateway.log"),
    join(logDir, "openclaw.log"),
  ];

  for (const path of candidates) {
    try {
      const content = readFileSync(path, "utf8");
      const lines = content.split("\n").filter(Boolean);
      return {
        lines: lines.slice(-lineCount),
        path,
      };
    } catch {
      continue;
    }
  }

  const { stdout } = await runOpenClaw(["gateway", "status", "--json"]);
  const statusPath = stdout
    ? (JSON.parse(stdout) as { logPath?: string }).logPath
    : undefined;

  if (statusPath) {
    try {
      const content = readFileSync(statusPath, "utf8");
      const lines = content.split("\n").filter(Boolean);
      return { lines: lines.slice(-lineCount), path: statusPath };
    } catch {
      /* fall through */
    }
  }

  return {
    lines: ["No log file found. Check ~/.openclaw/logs/ on the Pi."],
  };
}
