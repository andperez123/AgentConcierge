import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { GoogleAuthStatus } from "@concierge/shared";
import { MOCK_OPENCLAW } from "../config.js";
import { getOpenClawStatus } from "./adapter.js";
import { openclawEnv } from "./env.js";

let cached: GoogleAuthStatus | null = null;
let cachedAt = 0;
const CACHE_MS = 30_000;

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
      const stateRaw = String(google.state ?? google.status ?? "");
      const connected =
        google.connected === true ||
        stateRaw === "ok" ||
        stateRaw === "connected";
      cached = {
        state: connected
          ? "connected"
          : stateRaw === "missing"
            ? "missing"
            : "expired",
        account: google.email as string | undefined,
        lastCheckedAt: checkedAt,
        message: google.message as string | undefined,
        recommendedAction: connected ? undefined : "reauth",
      };
      cachedAt = now;
      return cached;
    }
  } catch {
    /* fall through */
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
