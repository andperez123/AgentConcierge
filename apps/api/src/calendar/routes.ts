import { Router } from "express";
import type {
  ActionResponse,
  CalendarEventInput,
  CalendarEventsResponse,
  SyncCalendarEventsBody,
} from "@concierge/shared";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getLastSyncAt,
  listCalendarEvents,
  syncCalendarEvents,
} from "./store.js";
import {
  startOperation,
  runCalendarSyncOperation,
} from "../operations/runner.js";

const router = Router();

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Default sync/list window: previous month start through +2 months. */
function defaultRange(): { start: string; end: string } {
  const now = new Date();
  const start = monthStart(now);
  start.setMonth(start.getMonth() - 1);
  const end = monthStart(now);
  end.setMonth(end.getMonth() + 2);
  return { start: start.toISOString(), end: end.toISOString() };
}

router.get("/events", (req, res) => {
  const from = req.query.from ? String(req.query.from) : undefined;
  const to = req.query.to ? String(req.query.to) : undefined;
  const body: CalendarEventsResponse = {
    events: listCalendarEvents(from, to),
    lastSyncAt: getLastSyncAt(),
  };
  res.json(body);
});

router.post("/events", (req, res) => {
  try {
    const payload = req.body ?? {};
    // Bulk sync shape: { events: [...], replaceRange?: {...} }
    if (Array.isArray(payload.events)) {
      const body = payload as SyncCalendarEventsBody;
      const result = syncCalendarEvents(body.events, body.replaceRange);
      res.status(201).json({ ok: true, ...result });
      return;
    }
    // Single-event shape.
    const event = createCalendarEvent(payload as CalendarEventInput);
    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Invalid calendar event",
    });
  }
});

router.delete("/events/:id", (req, res) => {
  if (deleteCalendarEvent(req.params.id)) {
    res.json({ ok: true });
    return;
  }
  res.status(404).json({ ok: false, message: "Event not found" });
});

router.post("/sync", (req, res) => {
  const body = req.body ?? {};
  let start: string;
  let end: string;
  if (body.rangeStart && body.rangeEnd) {
    start = String(body.rangeStart);
    end = String(body.rangeEnd);
  } else if (typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month)) {
    const [year, month] = body.month.split("-").map(Number);
    const from = new Date(year, month - 2, 1);
    const to = new Date(year, month + 1, 1);
    start = from.toISOString();
    end = to.toISOString();
  } else {
    const range = defaultRange();
    start = range.start;
    end = range.end;
  }

  const op = startOperation("calendar-sync");
  void runCalendarSyncOperation(op.operationId, start, end);
  const response: ActionResponse = {
    ok: true,
    message: "Google Calendar sync queued (optional)",
    at: op.acceptedAt,
    operationId: op.operationId,
  };
  res.status(202).json(response);
});

export default router;
