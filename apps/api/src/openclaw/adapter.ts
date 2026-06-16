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
  OPENCLAW_PROBE_RETRIES,
  OPENCLAW_PROBE_TIMEOUT_MS,
  PROBE_FAILURE_THRESHOLD,
  PROBE_RECOVERY_GRACE_MS,
  STATUS_CACHE_MS,
} from "../config.js";
import { getLastRestartAt } from "../db.js";
import { openclawEnv } from "./env.js";

const execFileAsync = promisify(execFile);

let cachedStatus: OpenClawStatus | null = null;
let cachedAt = 0;
let lastGoodStatus: OpenClawStatus | null = null;
let lastGoodAt = 0;
let consecutiveProbeFailures = 0;
let mockOnline = true;
let statusInFlight: Promise<OpenClawStatus> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readGatewayPort(): number {
  try {
    const home = openclawEnv().HOME ?? homedir();
    const configPath = join(home, ".openclaw", "openclaw.json");
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
      env: openclawEnv(),
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

async function fetchHealthzOnce(
  port: number,
): Promise<"ok" | "not_ready" | "unknown"> {
  try {
    const readyRes = await fetch(`http://127.0.0.1:${port}/readyz`, {
      signal: AbortSignal.timeout(OPENCLAW_PROBE_TIMEOUT_MS),
    });
    if (readyRes.ok) return "ok";
    const healthRes = await fetch(`http://127.0.0.1:${port}/healthz`, {
      signal: AbortSignal.timeout(OPENCLAW_PROBE_TIMEOUT_MS),
    });
    return healthRes.ok ? "not_ready" : "unknown";
  } catch {
    return "unknown";
  }
}

async function fetchHealthz(
  port: number,
): Promise<"ok" | "not_ready" | "unknown"> {
  const attempts = Math.max(1, OPENCLAW_PROBE_RETRIES);
  let last: "ok" | "not_ready" | "unknown" = "unknown";
  for (let i = 0; i < attempts; i++) {
    last = await fetchHealthzOnce(port);
    if (last !== "unknown") return last;
    if (i < attempts - 1) await sleep(200);
  }
  return last;
}

function buildOfflineStatus(checkedAt: string): OpenClawStatus {
  return {
    state: "offline",
    service: { running: false, unit: "openclaw-gateway.service" },
    probe: { reachable: false },
    readyz: "unknown",
    lastRestartAt: getLastRestartAt(),
    checkedAt,
    probeFailures: consecutiveProbeFailures,
  };
}

function applyProbeHysteresis(
  freshStatus: OpenClawStatus,
  probeFailed: boolean,
  now: number,
): OpenClawStatus {
  if (probeFailed) {
    consecutiveProbeFailures += 1;
    const withinGrace =
      lastGoodStatus !== null && now - lastGoodAt <= PROBE_RECOVERY_GRACE_MS;
    if (
      consecutiveProbeFailures < PROBE_FAILURE_THRESHOLD &&
      withinGrace &&
      lastGoodStatus
    ) {
      return {
        ...lastGoodStatus,
        checkedAt: freshStatus.checkedAt,
        stale: true,
        probeFailures: consecutiveProbeFailures,
      };
    }
    return {
      ...buildOfflineStatus(freshStatus.checkedAt),
      stale: true,
    };
  }

  consecutiveProbeFailures = 0;
  if (freshStatus.state === "online" || freshStatus.state === "degraded") {
    lastGoodStatus = freshStatus;
    lastGoodAt = now;
  }
  return { ...freshStatus, probeFailures: 0 };
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

async function probeStatus(force: boolean): Promise<OpenClawStatus> {
  const now = Date.now();
  if (!force && cachedStatus && now - cachedAt < STATUS_CACHE_MS) {
    return { ...cachedStatus, stale: now - cachedAt > STATUS_CACHE_MS * 2 };
  }

  if (MOCK_OPENCLAW) {
    cachedStatus = mockStatus();
    cachedAt = now;
    return cachedStatus;
  }

  const port = readGatewayPort();
  const checkedAt = new Date().toISOString();

  // Fast path: HTTP probes (avoids stacking slow CLI calls every 5s)
  const readyz = await fetchHealthz(port);
  const reachable = readyz !== "unknown";
  const serviceRunning = reachable;

  let parsed: Partial<OpenClawStatus> = {
    readyz,
    probe: { reachable },
    service: { running: serviceRunning, unit: "openclaw-gateway.service" },
  };

  if (reachable && (force || !cachedStatus || now - cachedAt > 15000)) {
    const { stdout } = await runOpenClaw(
      ["gateway", "status", "--json", "--no-probe"],
      8000,
    );
    if (stdout) {
      parsed = { ...parsed, ...parseGatewayStatusJson(stdout) };
    }
  }

  const freshStatus: OpenClawStatus = {
    state: mapState(
      parsed.service?.running ?? serviceRunning,
      parsed.probe?.reachable ?? reachable,
      parsed.readyz ?? readyz,
      parsed.eventLoopDegraded,
    ),
    service: parsed.service ?? { running: serviceRunning },
    probe: parsed.probe ?? { reachable },
    readyz: parsed.readyz ?? readyz,
    eventLoopDegraded: parsed.eventLoopDegraded,
    lastRestartAt: getLastRestartAt(),
    checkedAt,
  };

  const status = applyProbeHysteresis(freshStatus, !reachable, now);

  cachedStatus = status;
  cachedAt = now;
  return status;
}

export async function getOpenClawStatus(force = false): Promise<OpenClawStatus> {
  if (statusInFlight && !force) {
    return statusInFlight;
  }
  statusInFlight = probeStatus(force).finally(() => {
    statusInFlight = null;
  });
  return statusInFlight;
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

  let { stdout, stderr, code } = await runOpenClaw(args, 60000);

  if (code !== 0) {
    const home = openclawEnv().HOME ?? homedir();
    const uid = process.env.CONCIERGE_UID;
    const systemctl = uid
      ? [
          "systemctl",
          "--user",
          "restart",
          "openclaw-gateway.service",
        ]
      : null;
    if (systemctl) {
      try {
        await execFileAsync(systemctl[0], systemctl.slice(1), {
          timeout: 30000,
          env: openclawEnv(),
        });
        code = 0;
        stdout = "Restarted openclaw-gateway.service via systemctl --user";
      } catch (e: unknown) {
        const err = e as { stderr?: string; message?: string };
        stderr =
          stderr ||
          (err.stderr ?? err.message ?? "systemctl restart failed").toString();
      }
    }
  }

  cachedStatus = null;
  consecutiveProbeFailures = 0;
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

  const home = openclawEnv().HOME ?? homedir();
  const logDir = join(home, ".openclaw", "logs");
  const tmpDir = "/tmp/openclaw";
  const candidates = [
    join(tmpDir, `openclaw-${new Date().toISOString().slice(0, 10)}.log`),
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

export interface AgentTurnResult {
  ok: boolean;
  reply: string;
  mock?: boolean;
}

function extractAgentReply(stdout: string): string {
  const trimmed = stdout.trim();
  if (!trimmed) return "";
  try {
    const data = JSON.parse(trimmed) as Record<string, unknown>;
    for (const key of ["response", "reply", "message", "text"]) {
      const v = data[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    const result = data.result as Record<string, unknown> | undefined;
    if (result) {
      for (const key of ["response", "message", "text"]) {
        const v = result[key];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

function resolveAgentId(purpose: "voice" | "chat" = "voice"): string | undefined {
  const chat = process.env.OPENCLAW_CHAT_AGENT?.trim();
  const voice = process.env.OPENCLAW_VOICE_AGENT?.trim();
  if (purpose === "chat") return chat || voice || undefined;
  return voice || chat || undefined;
}

/** Run one agent turn via `openclaw agent --message` (Gateway on Pi). */
export async function sendAgentMessage(
  message: string,
  purpose: "voice" | "chat" = "voice",
): Promise<AgentTurnResult> {
  const text = message.trim();
  if (!text) throw new Error("Message is required");

  if (MOCK_OPENCLAW) {
    return {
      ok: true,
      mock: true,
      reply: `Got it: “${text}”. (Mock mode — on the Pi this runs openclaw agent.)`,
    };
  }

  const agentId = resolveAgentId(purpose);
  const args = ["agent", "--message", text, "--json"];
  if (agentId) args.splice(1, 0, "--agent", agentId);

  const result = await runOpenClaw(args, 120_000);
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || "Agent command failed");
  }

  const reply = extractAgentReply(result.stdout);
  return {
    ok: true,
    reply: reply || "Agent completed with no text reply.",
  };
}
