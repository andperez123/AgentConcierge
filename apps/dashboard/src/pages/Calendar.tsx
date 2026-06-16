import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  RefreshCw,
  X,
} from "lucide-react";
import type { CalendarEvent } from "@concierge/shared";
import {
  fetchCalendarEvents,
  fetchOperation,
  syncCalendar,
} from "../api";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GRID_CELLS = 42;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local YYYY-MM-DD key for a Date. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthParam(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function parseMonthParam(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  if (month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

/** Parse an event start/end which may be a date-only or a full ISO datetime. */
function toDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

/** All local day keys an event touches (handles multi-day + all-day events). */
function eventDayKeys(ev: CalendarEvent): string[] {
  const start = toDate(ev.start);
  if (Number.isNaN(start.getTime())) return [];
  const keys: string[] = [dayKey(start)];
  if (!ev.end) return keys;

  const end = toDate(ev.end);
  if (Number.isNaN(end.getTime())) return keys;

  // All-day end dates are exclusive in Google Calendar.
  const last = new Date(end);
  if (ev.allDay) last.setDate(last.getDate() - 1);

  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  last.setHours(0, 0, 0, 0);
  keys.length = 0;
  for (let i = 0; i < 366 && cursor <= last; i += 1) {
    keys.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys.length ? keys : [dayKey(start)];
}

function formatEventTime(ev: CalendarEvent): string {
  if (ev.allDay) return "All day";
  const d = toDate(ev.start);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatLastSync(iso?: string): string {
  if (!iso) return "Never synced";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never synced";
  return `Synced ${d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export default function Calendar() {
  const [params, setParams] = useSearchParams();
  const [monthDate, setMonthDate] = useState<Date>(
    () => parseMonthParam(params.get("month")) ?? new Date(),
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | undefined>();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const todayKey = useMemo(() => dayKey(new Date()), []);

  // 42-cell grid starting on the Sunday on/before the 1st of the month.
  const gridDays = useMemo(() => {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: GRID_CELLS }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [monthDate]);

  const gridRange = useMemo(() => {
    const from = gridDays[0];
    const to = new Date(gridDays[GRID_CELLS - 1]);
    to.setDate(to.getDate() + 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [gridDays]);

  const load = useCallback(async () => {
    try {
      const data = await fetchCalendarEvents(gridRange);
      setEvents(data.events);
      setLastSyncAt(data.lastSyncAt);
    } catch {
      setEvents([]);
    }
  }, [gridRange]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live updates when the agent pushes events.
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/dashboard/events");
      es.addEventListener("state-changed", () => void load());
    } catch {
      /* polling-free fallback: rely on manual reload */
    }
    return () => es?.close();
  }, [load]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      for (const key of eventDayKeys(ev)) {
        const list = map.get(key) ?? [];
        list.push(ev);
        map.set(key, list);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return toDate(a.start).getTime() - toDate(b.start).getTime();
      });
    }
    return map;
  }, [events]);

  const changeMonth = useCallback(
    (next: Date) => {
      setMonthDate(next);
      setSelectedDay(null);
      setParams({ month: monthParam(next) }, { replace: true });
    },
    [setParams],
  );

  const goPrev = () =>
    changeMonth(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1));
  const goNext = () =>
    changeMonth(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    changeMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const pollOperation = useCallback(
    (operationId: string) => {
      let attempts = 0;
      const tick = async () => {
        attempts += 1;
        try {
          const op = await fetchOperation(operationId);
          if (
            op.state === "succeeded" ||
            op.state === "failed" ||
            op.state === "timed_out" ||
            op.state === "canceled"
          ) {
            setSyncing(false);
            setSyncMessage(
              op.state === "succeeded"
                ? (op.message ?? "Calendar synced")
                : (op.message ?? "Sync failed"),
            );
            await load();
            return;
          }
        } catch {
          /* keep polling */
        }
        if (attempts < 60) {
          pollRef.current = setTimeout(() => void tick(), 2000);
        } else {
          setSyncing(false);
          setSyncMessage("Sync is taking longer than expected.");
        }
      };
      pollRef.current = setTimeout(() => void tick(), 2000);
    },
    [load],
  );

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncMessage("Pulling Google Calendar…");
    try {
      const res = await syncCalendar({ month: monthParam(monthDate) });
      if (res.operationId) {
        pollOperation(res.operationId);
      } else {
        setSyncing(false);
        await load();
      }
    } catch (e) {
      setSyncing(false);
      setSyncMessage(e instanceof Error ? e.message : "Sync failed");
    }
  }, [syncing, monthDate, pollOperation, load]);

  const selectedEvents = selectedDay
    ? (eventsByDay.get(selectedDay) ?? [])
    : [];

  return (
    <div className="app-kiosk calendar-page">
      <header className="calendar-page__header">
        <div className="calendar-page__title-wrap">
          <h1 className="calendar-page__title">
            <CalendarDays size={24} strokeWidth={2.2} />
            {formatMonthLabel(monthDate)}
          </h1>
          <span className="calendar-page__sync-label">
            {syncMessage ?? formatLastSync(lastSyncAt)}
          </span>
        </div>
        <div className="calendar-page__controls">
          <button
            type="button"
            className="calendar-nav-btn"
            aria-label="Previous month"
            onClick={goPrev}
          >
            <ChevronLeft size={24} />
          </button>
          <button type="button" className="calendar-today-btn" onClick={goToday}>
            Today
          </button>
          <button
            type="button"
            className="calendar-nav-btn"
            aria-label="Next month"
            onClick={goNext}
          >
            <ChevronRight size={24} />
          </button>
          <button
            type="button"
            className="calendar-sync-btn"
            onClick={() => void handleSync()}
            disabled={syncing}
          >
            <RefreshCw
              size={20}
              className={syncing ? "calendar-sync-btn__spin" : undefined}
            />
            <span>{syncing ? "Syncing" : "Sync"}</span>
          </button>
        </div>
      </header>

      <div className="calendar-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="calendar-weekday">
            {w}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {gridDays.map((day) => {
          const key = dayKey(day);
          const inMonth = day.getMonth() === monthDate.getMonth();
          const isToday = key === todayKey;
          const dayEvents = eventsByDay.get(key) ?? [];
          const shown = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - shown.length;
          return (
            <button
              type="button"
              key={key}
              className={`calendar-cell${inMonth ? "" : " calendar-cell--muted"}${
                isToday ? " calendar-cell--today" : ""
              }`}
              onClick={() => setSelectedDay(key)}
            >
              <span className="calendar-cell__num">{day.getDate()}</span>
              <span className="calendar-cell__events">
                {shown.map((ev, i) => (
                  <span
                    key={`${ev.id}-${i}`}
                    className={`calendar-chip${ev.allDay ? " calendar-chip--allday" : ""}`}
                  >
                    {!ev.allDay && (
                      <span className="calendar-chip__time">
                        {formatEventTime(ev)}
                      </span>
                    )}
                    <span className="calendar-chip__title">{ev.title}</span>
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="calendar-chip calendar-chip--more">
                    +{overflow} more
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div
          className="calendar-day-sheet"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="calendar-day-sheet__panel"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="calendar-day-sheet__header">
              <h2 className="calendar-day-sheet__title">
                {toDate(selectedDay).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              <button
                type="button"
                className="calendar-day-sheet__close"
                aria-label="Close"
                onClick={() => setSelectedDay(null)}
              >
                <X size={22} />
              </button>
            </header>
            {selectedEvents.length === 0 ? (
              <p className="calendar-day-sheet__empty">No events</p>
            ) : (
              <ul className="calendar-day-sheet__list">
                {selectedEvents.map((ev, i) => (
                  <li key={`${ev.id}-${i}`} className="calendar-event-row">
                    <span className="calendar-event-row__time">
                      {formatEventTime(ev)}
                    </span>
                    <span className="calendar-event-row__body">
                      <span className="calendar-event-row__title">
                        {ev.title}
                      </span>
                      {ev.location && (
                        <span className="calendar-event-row__meta">
                          <MapPin size={14} /> {ev.location}
                        </span>
                      )}
                      {ev.description && (
                        <span className="calendar-event-row__desc">
                          {ev.description}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
