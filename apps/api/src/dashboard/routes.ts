import { Router } from "express";
import type { CreateAlertBody, DashboardCommand } from "@concierge/shared";
import { buildDashboardState, setClientScreen, incrementTouchTest, getTouchTestCount } from "./state.js";
import { enqueueCommand } from "./commands.js";
import { registerSseClient } from "./events.js";
import { getOperation } from "../db.js";
import { listAlerts, createAlert, ackAlert, deleteAlert } from "../alerts.js";
import {
  startOperation,
  runRestartOperation,
  runDoctorOperation,
  runReauthOperation,
  runRefreshProbesOperation,
} from "../operations/runner.js";

const router = Router();

router.get("/state", async (req, res) => {
  try {
    const force = req.query.force === "1";
    const state = await buildDashboardState(force);
    res.json(state);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "State build failed",
    });
  }
});

router.get("/events", (req, res) => {
  registerSseClient(res);
});

router.post("/commands", (req, res) => {
  try {
    const cmd = req.body as DashboardCommand;
    const { id } = enqueueCommand(cmd);
    res.status(201).json({ ok: true, id });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Invalid command",
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
    const alert = createAlert(body);
    res.status(201).json(alert);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Invalid alert",
    });
  }
});

router.post("/alerts/:id/ack", (req, res) => {
  if (ackAlert(req.params.id)) {
    res.json({ ok: true });
  } else {
    res.status(404).json({ ok: false, message: "Alert not found" });
  }
});

router.delete("/alerts/:id", (req, res) => {
  if (deleteAlert(req.params.id)) {
    res.json({ ok: true });
  } else {
    res.status(404).json({ ok: false });
  }
});

router.post("/actions/restart-gateway", async (req, res) => {
  const op = startOperation("restart-gateway");
  const force = req.body?.force === true;
  void runRestartOperation(op.operationId, force);
  res.status(202).json(op);
});

router.post("/actions/run-doctor", async (_req, res) => {
  const op = startOperation("run-doctor");
  void runDoctorOperation(op.operationId);
  res.status(202).json(op);
});

router.post("/actions/reauth", async (_req, res) => {
  const op = startOperation("reauth");
  void runReauthOperation(op.operationId);
  res.status(202).json(op);
});

router.post("/actions/refresh-probes", async (_req, res) => {
  const op = startOperation("refresh-probes");
  void runRefreshProbesOperation(op.operationId);
  res.status(202).json(op);
});

export { setClientScreen, incrementTouchTest, getTouchTestCount };
export default router;
