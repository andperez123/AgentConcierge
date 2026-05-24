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
import { getOperation } from "./db.js";
import { getLogs, getOpenClawStatus, sendAgentMessage } from "./openclaw/adapter.js";
import { mapToSystemHealth } from "./openclaw/health.js";
import {
  createNote,
  dismissNote,
  getNote,
  listCompletedNotes,
  listNotes,
  updateNote,
} from "./notes.js";
import {
  createReminder,
  dismissReminder,
  getReminder,
  listCompletedReminders,
  listReminders,
  updateReminder,
} from "./reminders.js";
import {
  getProject,
  getProjectBreakdown,
  listProjects,
  syncProject,
} from "./openclaw/projects.js";
import { getGoogleAuthStatus } from "./openclaw/google.js";
import { queueWorkEntityAction } from "./work/actions.js";
import type { SyncProjectBody, WorkEntityActionBody, WorkEntityKind } from "@concierge/shared";
import dashboardRouter, {
  setClientScreen,
  incrementTouchTest,
  getTouchTestCount,
} from "./dashboard/routes.js";
import { getClientScreenInfo } from "./dashboard/state.js";
import { listIncidents, parseLogIncidents } from "./incidents.js";
import {
  listAlerts,
  createAlert,
  ackAlert,
  deleteAlert,
} from "./alerts.js";
import type { CreateAlertBody, SetHeroBody } from "@concierge/shared";
import { getHeroDisplay, setHeroDisplay } from "./display/hero.js";
import { emitDashboardEvent } from "./dashboard/events.js";
import {
  buildMockVoiceReply,
  buildVoiceAgentMessage,
} from "./voice/context.js";
import { listRestartEvents } from "./db.js";
import {
  startOperation,
  runRestartOperation,
  runDoctorOperation,
  runReauthOperation,
} from "./operations/runner.js";
import {
  collectDeviceMetrics,
  checkNetworkOnline,
} from "./device/metrics.js";
import {
  arch as osArch,
  hostname,
  platform as osPlatform,
  uptime,
} from "node:os";

const router = Router();

router.use("/dashboard", dashboardRouter);

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
  const force = req.body?.force === true;
  const op = startOperation("restart-gateway");
  void runRestartOperation(op.operationId, force);
  const body: ActionResponse = {
    ok: true,
    message: "Restart queued",
    at: op.acceptedAt,
    operationId: op.operationId,
  };
  res.status(202).json(body);
});

router.post("/openclaw/doctor", async (_req, res) => {
  const op = startOperation("run-doctor");
  void runDoctorOperation(op.operationId);
  const body: ActionResponse = {
    ok: true,
    message: "Doctor queued",
    at: op.acceptedAt,
    operationId: op.operationId,
  };
  res.status(202).json(body);
});

router.post("/openclaw/reauth", async (_req, res) => {
  const op = startOperation("reauth");
  void runReauthOperation(op.operationId);
  const body: ActionResponse = {
    ok: true,
    message: "Reauth queued",
    at: op.acceptedAt,
    operationId: op.operationId,
  };
  res.status(202).json(body);
});

router.get("/openclaw/logs", async (req, res) => {
  try {
    const lines = Math.min(Number(req.query.lines ?? 200), 500);
    const result = await getLogs(lines);
    parseLogIncidents(result.lines);
    const body: LogsResponse = result;
    res.json(body);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to read logs",
    });
  }
});

router.get("/openclaw/restarts", (_req, res) => {
  res.json(listRestartEvents(20));
});

router.get("/alerts", (_req, res) => {
  res.json(listAlerts(false));
});

router.post("/alerts", (req, res) => {
  try {
    const body = req.body as CreateAlertBody;
    if (!body?.title || !body?.message) {
      res.status(400).json({ error: "title and message required" });
      return;
    }
    res.status(201).json(createAlert(body));
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Invalid alert",
    });
  }
});

router.post("/alerts/:id/ack", (req, res) => {
  if (ackAlert(req.params.id)) res.json({ ok: true });
  else res.status(404).json({ ok: false });
});

router.delete("/alerts/:id", (req, res) => {
  if (deleteAlert(req.params.id)) res.json({ ok: true });
  else res.status(404).json({ ok: false });
});

router.get("/events/incidents", (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 5), 50);
  const severity = req.query.severity
    ? String(req.query.severity)
    : undefined;
  res.json(listIncidents({ limit, severity }));
});

router.get("/logs/diagnostic-bundle", async (_req, res) => {
  try {
    const status = await getOpenClawStatus(true);
    const health = mapToSystemHealth(status);
    const logs = await getLogs(50);
    parseLogIncidents(logs.lines);
    const metrics = collectDeviceMetrics();
    const networkOnline = await checkNetworkOnline();
    res.json({
      health,
      incidents: listIncidents({ limit: 5 }),
      restarts: listRestartEvents(5),
      device: {
        hostname: hostname(),
        uptimeSeconds: Math.floor(uptime()),
        platform: osPlatform(),
        arch: osArch(),
        metrics,
        networkOnline,
      },
      logLines: logs.lines,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Diagnostic failed",
    });
  }
});

router.get("/operations/:id", (req, res) => {
  const op = getOperation(req.params.id);
  if (!op) {
    res.status(404).json({ error: "Operation not found" });
    return;
  }
  res.json(op);
});

router.get("/device/status", async (_req, res) => {
  const metrics = collectDeviceMetrics();
  const networkOnline = await checkNetworkOnline();
  const { screen, kiosk } = getClientScreenInfo();
  const body: DeviceStatus = {
    hostname: hostname(),
    uptimeSeconds: Math.floor(uptime()),
    platform: osPlatform(),
    arch: osArch(),
    screen,
    kiosk,
    touchTestCount: getTouchTestCount(),
    metrics,
    networkOnline,
  };
  res.json(body);
});

router.post("/device/screen", (req, res) => {
  const { width, height, kiosk } = req.body ?? {};
  if (typeof width === "number" && typeof height === "number") {
    setClientScreen(width, height, Boolean(kiosk));
  } else if (typeof kiosk === "boolean") {
    setClientScreen(
      typeof width === "number" ? width : 1024,
      typeof height === "number" ? height : 600,
      kiosk,
    );
  }
  res.json({ ok: true });
});

router.post("/device/touch-test", (_req, res) => {
  const count = incrementTouchTest();
  res.json({ count, at: new Date().toISOString() });
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

router.get("/openclaw/google/status", async (req, res) => {
  try {
    const force = req.query.force === "1";
    res.json(await getGoogleAuthStatus(force));
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Google status failed",
    });
  }
});

router.post("/openclaw/google/reauth", async (_req, res) => {
  const op = startOperation("google-reauth");
  void runReauthOperation(op.operationId);
  const body: ActionResponse = {
    ok: true,
    message: "Google reauth queued — check Pi terminal if a code appears",
    at: op.acceptedAt,
    operationId: op.operationId,
  };
  res.status(202).json(body);
});

router.get("/projects", (_req, res) => {
  res.json(listProjects());
});

router.get("/projects/:id", (req, res) => {
  const breakdown = getProjectBreakdown(req.params.id);
  if (!breakdown) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(breakdown);
});

router.post("/projects/sync", (req, res) => {
  try {
    const project = syncProject(req.body as SyncProjectBody);
    emitDashboardEvent("state-changed", {});
    res.status(201).json(project);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Invalid project sync",
    });
  }
});

router.get("/reminders", (req, res) => {
  const projectId = req.query.projectId
    ? String(req.query.projectId)
    : undefined;
  const status = req.query.status === "completed" ? "completed" : "active";
  res.json(
    status === "completed"
      ? listCompletedReminders(projectId)
      : listReminders(projectId),
  );
});

router.get("/reminders/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const reminder = getReminder(id);
  if (!reminder) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }
  res.json(reminder);
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

router.patch("/reminders/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const reminder = updateReminder(id, req.body ?? {});
    if (!reminder) {
      res.status(404).json({ error: "Reminder not found" });
      return;
    }
    res.json(reminder);
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

router.get("/notes", (req, res) => {
  const projectId = req.query.projectId
    ? String(req.query.projectId)
    : undefined;
  const status = req.query.status === "completed" ? "completed" : "active";
  res.json(
    status === "completed"
      ? listCompletedNotes(projectId)
      : listNotes(projectId),
  );
});

router.get("/notes/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const note = getNote(id);
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.json(note);
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

router.patch("/notes/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const note = updateNote(id, req.body ?? {});
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json(note);
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

router.post("/work/:kind/:id/actions", (req, res) => {
  const kind = req.params.kind as WorkEntityKind;
  if (!["reminder", "note", "project"].includes(kind)) {
    res.status(400).json({ error: "Invalid entity kind" });
    return;
  }
  if (kind === "project" && !getProject(req.params.id)) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (kind === "reminder" && !getReminder(Number(req.params.id))) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }
  if (kind === "note" && !getNote(Number(req.params.id))) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  const body = req.body as WorkEntityActionBody;
  if (!body?.action) {
    res.status(400).json({ error: "action is required" });
    return;
  }
  const op = queueWorkEntityAction(kind, req.params.id, body);
  res.status(202).json({
    ok: true,
    operationId: op.operationId,
    acceptedAt: op.acceptedAt,
    state: op.state,
  });
});

router.get("/display/hero", (_req, res) => {
  res.json(getHeroDisplay());
});

router.post("/voice/command", async (req, res) => {
  try {
    const text = String(req.body?.text ?? "").trim();
    if (!text) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    if (MOCK_OPENCLAW) {
      res.json({
        ok: true,
        reply: buildMockVoiceReply(text),
        mock: true,
        at: new Date().toISOString(),
      });
      return;
    }
    const message = buildVoiceAgentMessage(text);
    const result = await sendAgentMessage(message);
    res.json({
      ok: result.ok,
      reply: result.reply,
      mock: result.mock,
      at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Voice command failed",
    });
  }
});

router.post("/display/hero", (req, res) => {
  try {
    const body = req.body as SetHeroBody;
    if (!body?.quote) {
      res.status(400).json({ error: "quote is required" });
      return;
    }
    const hero = setHeroDisplay(body);
    emitDashboardEvent("state-changed", {});
    res.status(201).json(hero);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Invalid hero display",
    });
  }
});

export default router;
