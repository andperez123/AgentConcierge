import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { GoogleAuthStatus } from "@concierge/shared";
import { MOCK_OPENCLAW, OPENCLAW_BIN } from "../config.js";
import { getOpenClawStatus } from "./adapter.js";
import { openclawEnv } from "./env.js";

const execFileAsync = promisify(execFile);

let cached: GoogleAuthStatus | null = null;
let cachedAt = 0;
const CACHE_MS = 30_000;

export function invalidateGoogleAuthCache(): void {
  cached = null;
  cachedAt = 0;
}

async function runOpenClawJson(
  args: string[],
  timeoutMs = 45_000,
): Promise<Record<string, unknown> | null> {
  try {
    const { stdout } = await execFileAsync(OPENCLAW_BIN, args, {
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
      env: openclawEnv(),
    });
    const raw = stdout.trim();
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function statusFromGoogleRecord(
  google: Record<string, unknown>,
  checkedAt: string,
): GoogleAuthStatus {
  const stateRaw = String(google.state ?? google.status ?? "");
  const connected =
    google.connected === true ||
    stateRaw === "ok" ||
    stateRaw === "connected" ||
    google.authenticated === true;
  const scopes = Array.isArray(google.scopes)
    ? (google.scopes as string[])
    : undefined;
  const hasDrive =
    scopes?.some((s) => /drive/i.test(s)) ||
    google.drive === true ||
    google.driveConnected === true;

  let message = google.message as string | undefined;
  if (connected && hasDrive) {
    message = message ?? "Connected — Google Drive available for Save to Drive";
  } else if (connected) {
    message = message ?? "Connected — use Reauth if Drive export fails";
  }

  return {
    state: connected
      ? "connected"
      : stateRaw === "missing"
        ? "missing"
        : "expired",
    account:
      (google.email as string) ??
      (google.account as string) ??
      (google.user as string),
    scopes,
    lastCheckedAt: checkedAt,
    message,
    recommendedAction: connected ? undefined : "reauth",
  };
}

async function probeGoogleViaCli(): Promise<GoogleAuthStatus | null> {
  const checkedAt = new Date().toISOString();

  const authStatus = await runOpenClawJson(
    ["gateway", "auth", "status", "--json"],
    12_000,
  );
  if (authStatus) {
    const google =
      (authStatus.google as Record<string, unknown>) ??
      (authStatus.providers as Record<string, unknown>)?.google;
    if (google && typeof google === "object") {
      return statusFromGoogleRecord(google, checkedAt);
    }
    if (authStatus.connected === true || authStatus.authenticated === true) {
      return {
        state: "connected",
        account: authStatus.email as string | undefined,
        lastCheckedAt: checkedAt,
        message: "Gateway auth OK",
      };
    }
  }

  const integrations = await runOpenClawJson(
    ["integrations", "status", "--json"],
    12_000,
  );
  if (integrations) {
    const google = integrations.google as Record<string, unknown> | undefined;
    if (google) return statusFromGoogleRecord(google, checkedAt);
  }

  const gateway = await runOpenClawJson(
    ["gateway", "status", "--json", "--no-probe"],
    12_000,
  );
  if (gateway) {
    const ints = gateway.integrations as Record<string, unknown> | undefined;
    const google = ints?.google as Record<string, unknown> | undefined;
    if (google) return statusFromGoogleRecord(google, checkedAt);
  }

  return null;
}

function readJsonFile(path: string): Record<string, unknown> | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function probeAuthFiles(): GoogleAuthStatus | null {
  const home = openclawEnv().HOME ?? homedir();
  const candidates = [
    join(home, ".openclaw", "google-auth.json"),
    join(home, ".openclaw", "auth", "google.json"),
    join(home, "clawd", "secrets", "google.json"),
    join(home, "clawd", "secrets", "google-auth.json"),
  ];

  for (const path of candidates) {
    const data = readJsonFile(path);
    if (!data) continue;
    const email =
      (data.email as string) ??
      (data.account as string) ??
      (data.user as string);
    const expired =
      data.expired === true ||
      data.valid === false ||
      data.status === "expired";
    if (expired) {
      return {
        state: "expired",
        account: email,
        lastCheckedAt: new Date().toISOString(),
        message: "Google token expired",
        recommendedAction: "reauth",
      };
    }
    return {
      state: "connected",
      account: email,
      lastCheckedAt: new Date().toISOString(),
      message: "Credentials found on disk",
    };
  }
  return null;
}

export async function getGoogleAuthStatus(
  force = false,
): Promise<GoogleAuthStatus> {
  const now = Date.now();
  if (!force && cached && now - cachedAt < CACHE_MS) return cached;
  if (force) invalidateGoogleAuthCache();

  const checkedAt = new Date().toISOString();

  if (MOCK_OPENCLAW) {
    cached = {
      state: "connected",
      account: "mock@example.com",
      lastCheckedAt: checkedAt,
      message: "Mock Google auth",
    };
    cachedAt = now;
    return cached;
  }

  try {
    const status = await getOpenClawStatus(force);
    const raw = status as unknown as Record<string, unknown>;
    const integrations = raw.integrations as Record<string, unknown> | undefined;
    const google = integrations?.google as Record<string, unknown> | undefined;
    if (google) {
      cached = statusFromGoogleRecord(google, checkedAt);
      cachedAt = now;
      return cached;
    }
  } catch {
    /* fall through */
  }

  const cliProbe = await probeGoogleViaCli();
  if (cliProbe) {
    cached = cliProbe;
    cachedAt = now;
    return cached;
  }

  const fileProbe = probeAuthFiles();
  if (fileProbe) {
    cached = fileProbe;
    cachedAt = now;
    return cached;
  }

  cached = {
    state: "unknown",
    lastCheckedAt: checkedAt,
    message: "Could not verify Google auth",
    recommendedAction: "run-doctor",
  };
  cachedAt = now;
  return cached;
}
