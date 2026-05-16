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
  searchGeocode,
} from "./weather/service.js";
import {
  getAppSettings,
  saveTempUnit,
  saveWeatherLocation,
} from "./settings.js";
import { MOCK_OPENCLAW, VERSION } from "./config.js";
import { recordRestart } from "./db.js";
import {
  getLogs,
  getOpenClawStatus,
  restartGateway,
  runDoctor,
} from "./openclaw/adapter.js";
import {
  createNote,
  dismissNote,
  listNotes,
} from "./notes.js";
import {
  createReminder,
  dismissReminder,
  listReminders,
} from "./reminders.js";
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
    const lines = Math.min(Number(req.query.lines ?? 200), 500);
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
  res.json(getAppSettings());
});

router.get("/geocode", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) {
      res.json([]);
      return;
    }
    const results = await searchGeocode(q);
    res.json(results);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Geocode failed",
    });
  }
});

router.post("/settings", async (req, res) => {
  try {
    const body = req.body ?? {};
    if (body.tempUnit === "fahrenheit" || body.tempUnit === "celsius") {
      saveTempUnit(body.tempUnit);
    }

    const lat = body.latitude;
    const lon = body.longitude;
    const cityLabel = String(body.city ?? "").trim();

    if (typeof lat === "number" && typeof lon === "number" && cityLabel) {
      saveWeatherLocation(cityLabel, lat, lon);
    } else {
      const query = String(body.query ?? body.city ?? "").trim();
      if (!query) {
        if (body.tempUnit) {
          clearWeatherCache();
          const settings: AppSettings = getAppSettings();
          res.json({
            ok: true,
            settings,
            message: "Units updated",
          } satisfies SettingsSaveResponse);
          return;
        }
        res.status(400).json({ ok: false, message: "City or location required" });
        return;
      }
      const geo = await geocodeCity(query);
      saveWeatherLocation(geo.name, geo.latitude, geo.longitude);
    }

    clearWeatherCache();
    const settings = getAppSettings();
    res.json({
      ok: true,
      settings,
      message: `Saved ${settings.city ?? "location"}`,
    } satisfies SettingsSaveResponse);
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

router.get("/reminders", (_req, res) => {
  res.json(listReminders());
});

router.post("/reminders", (req, res) => {
  try {
    const reminder = createReminder(req.body ?? {});
    res.status(201).json(reminder);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Invalid reminder",
    });
  }
});

router.delete("/reminders/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || !dismissReminder(id)) {
    res.status(404).json({ ok: false, message: "Reminder not found" });
    return;
  }
  res.json({ ok: true });
});

router.get("/notes", (_req, res) => {
  res.json(listNotes());
});

router.post("/notes", (req, res) => {
  try {
    const note = createNote(req.body ?? {});
    res.status(201).json(note);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Invalid note",
    });
  }
});

router.delete("/notes/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || !dismissNote(id)) {
    res.status(404).json({ ok: false, message: "Note not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
