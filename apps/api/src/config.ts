import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.PORT ?? 3080);
/** Only for local dev without the openclaw CLI. Never used in production. */
export const MOCK_OPENCLAW =
  process.env.NODE_ENV !== "production" &&
  (process.env.MOCK_OPENCLAW === "1" || process.env.MOCK_OPENCLAW === "true");
export const OPENCLAW_BIN = process.env.OPENCLAW_BIN ?? "openclaw";
export const OPENCLAW_GATEWAY_PORT = Number(
  process.env.OPENCLAW_GATEWAY_PORT ?? 18789,
);
export const VERSION = "0.2.0";
export const DATA_DIR =
  process.env.CONCIERGE_DATA_DIR ?? join(__dirname, "..", "data");
export const DASHBOARD_DIST =
  process.env.DASHBOARD_DIST ?? join(__dirname, "..", "..", "dashboard", "dist");
export const STATUS_CACHE_MS = 2000;
export const WEATHER_CACHE_MINUTES = Number(
  process.env.WEATHER_CACHE_MINUTES ?? 15,
);
