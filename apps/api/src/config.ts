import { config } from "dotenv";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const home =
  process.env.CONCIERGE_HOME ?? process.env.HOME ?? homedir();
export const OPENCLAW_CLAWD_DIR =
  process.env.OPENCLAW_CLAWD_DIR ?? join(home, "clawd");
export const OPENCLAW_PROJECTS_DIR =
  process.env.OPENCLAW_PROJECTS_DIR ?? join(OPENCLAW_CLAWD_DIR, "projects");
export const OPENCLAW_EXPORT_DIR =
  process.env.OPENCLAW_EXPORT_DIR ?? join(OPENCLAW_CLAWD_DIR, "exports");

export const PORT = Number(process.env.PORT ?? 3080);
/** Only for local dev without the openclaw CLI. Never used in production. */
export const MOCK_OPENCLAW =
  process.env.NODE_ENV !== "production" &&
  (process.env.MOCK_OPENCLAW === "1" || process.env.MOCK_OPENCLAW === "true");
export const OPENCLAW_BIN = process.env.OPENCLAW_BIN ?? "openclaw";
export const OPENCLAW_GATEWAY_PORT = Number(
  process.env.OPENCLAW_GATEWAY_PORT ?? 18789,
);
export const VERSION = "0.4.0";
export const DATA_DIR =
  process.env.CONCIERGE_DATA_DIR ?? join(__dirname, "..", "data");
export const DASHBOARD_DIST =
  process.env.DASHBOARD_DIST ?? join(__dirname, "..", "..", "dashboard", "dist");
export const STATUS_CACHE_MS = 2000;
export const OPENCLAW_PROBE_TIMEOUT_MS = Number(
  process.env.OPENCLAW_PROBE_TIMEOUT_MS ?? 5000,
);
export const OPENCLAW_PROBE_RETRIES = Number(
  process.env.OPENCLAW_PROBE_RETRIES ?? 2,
);
export const PROBE_FAILURE_THRESHOLD = Number(
  process.env.PROBE_FAILURE_THRESHOLD ?? 3,
);
export const PROBE_RECOVERY_GRACE_MS = Number(
  process.env.PROBE_RECOVERY_GRACE_MS ?? 30000,
);
export const WEATHER_CACHE_MINUTES = Number(
  process.env.WEATHER_CACHE_MINUTES ?? 5,
);
