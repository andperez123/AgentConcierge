import { Router } from "express";
import type {
  ActionResponse,
  AppSettings,
  DeviceStatus,
  HealthResponse,
  LogsResponse,
  SettingsSaveResponse,
} from "@concierge/shared";
import {
  clearWeatherCache,
  geocodeCity,
  getWeather,
} from "./weather/service.js";
import { getAppSettings, saveWeatherLocation } from "./settings.js";
import { MOCK_OPENCLAW, VERSION } from "./config.js";
import { recordRestart } from "./db.js";
import {
  getLogs,
  getOpenClawStatus,
  restartGateway,
  runDoctor,
} from "./openclaw/adapter.js";
import {
  arch as osArch,
  hostname,
  platform as osPlatform,
  uptime,
} from "node:os";

const router = Router();

let clientScreen: { width: number; height: number } | undefined;
let touchTestCount = 0;
let clientKiosk = false;

router.get("/health", (_req, res) => {
  const body: HealthResponse = {
    ok: true,
    version: VERSION,
    mock: MOCK_OPENCLAW,
  };
  res.json(body);
});

router.get("/openclaw/status", async (req, res) => {
  try {
    const force = req.query.force === "1";
    const status = await getOpenClawStatus(force);
    res.json(status);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Status check failed",
    });
  }
});

router.post("/openclaw/restart", async (req, res) => {
  try {
    const force = req.body?.force === true;
    const result = await restartGateway(force);
    recordRestart(
      force ? "force" : "safe",
      result.ok ? 0 : 1,
      result.message,
    );
    const body: ActionResponse = {
      ok: result.ok,
      message: result.message,
      at: new Date().toISOString(),
    };
    res.status(result.ok ? 200 : 500).json(body);
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : "Restart failed",
      at: new Date().toISOString(),
    });
  }
});

router.post("/openclaw/doctor", async (_req, res) => {
  try {
    const result = await runDoctor();
    const body: ActionResponse = {
      ok: result.ok,
      message: result.message,
      at: new Date().toISOString(),
    };
    res.status(result.ok ? 200 : 500).json(body);
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : "Doctor failed",
      at: new Date().toISOString(),
    });
  }
});

router.get("/openclaw/logs", async (req, res) => {
  try {
    const lines = Math.min(
      Number(req.query.lines ?? 200),
      500,
    );
    const result = await getLogs(lines);
    const body: LogsResponse = result;
    res.json(body);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to read logs",
    });
  }
});

router.get("/device/status", (_req, res) => {
  const body: DeviceStatus = {
    hostname: hostname(),
    uptimeSeconds: Math.floor(uptime()),
    platform: osPlatform(),
    arch: osArch(),
    screen: clientScreen,
    kiosk: clientKiosk,
    touchTestCount,
  };
  res.json(body);
});

router.post("/device/screen", (req, res) => {
  const { width, height, kiosk } = req.body ?? {};
  if (typeof width === "number" && typeof height === "number") {
    clientScreen = { width, height };
  }
  if (typeof kiosk === "boolean") clientKiosk = kiosk;
  res.json({ ok: true });
});

router.post("/device/touch-test", (_req, res) => {
  touchTestCount += 1;
  res.json({ count: touchTestCount, at: new Date().toISOString() });
});

router.get("/settings", (_req, res) => {
  const body: AppSettings = getAppSettings();
  res.json(body);
});

router.post("/settings", async (req, res) => {
  try {
    const city = String(req.body?.city ?? "").trim();
    if (!city) {
      res.status(400).json({ ok: false, message: "City is required" });
      return;
    }
    const geo = await geocodeCity(city);
    saveWeatherLocation(geo.name, geo.latitude, geo.longitude);
    clearWeatherCache();
    const settings: AppSettings = getAppSettings();
    const body: SettingsSaveResponse = {
      ok: true,
      settings,
      message: `Saved ${geo.name}`,
    };
    res.json(body);
  } catch (err) {
    res.status(400).json({
      ok: false,
      message: err instanceof Error ? err.message : "Failed to save settings",
    });
  }
});

router.get("/weather", async (req, res) => {
  try {
    const force = req.query.force === "1";
    const weather = await getWeather(force);
    if (!weather) {
      res.status(404).json({
        error: "No city configured",
        hint: "Open Settings and set your city",
      });
      return;
    }
    res.json(weather);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Weather fetch failed",
    });
  }
});

export default router;
