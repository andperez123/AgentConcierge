import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import type { CalendarEvent } from "@concierge/shared";
import CalendarEventComposer, {
  draftToEventInput,
  type CalendarEventDraft,
} from "../components/CalendarEventComposer";
import {
  createCalendarEvent,
  deleteCalendarEvent,
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
  if (!iso) return "Google not synced";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Google not synced";
  return `Google synced ${d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function isGoogleEvent(ev: CalendarEvent): boolean {
  return ev.source === "google" || Boolean(ev.googleId);
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
  const [composerDay, setComposerDay] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
      setComposerDay(null);
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
    setSyncMessage("Pulling from Google Calendar…");
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

  const monthEventCount = useMemo(() => {
    const inMonth = new Set<string>();
    for (const ev of events) {
      for (const key of eventDayKeys(ev)) {
        const [y, m] = key.split("-").map(Number);
        if (y === monthDate.getFullYear() && m - 1 === monthDate.getMonth()) {
          inMonth.add(ev.id);
        }
      }
    }
    return inMonth.size;
  }, [events, monthDate]);

  function openComposer(day?: string) {
    const key = day ?? todayKey;
    setComposerDay(key);
    setSelectedDay(key);
  }

  async function handleCreateEvent(day: string, draft: CalendarEventDraft) {
    await createCalendarEvent(draftToEventInput(day, draft));
    setComposerDay(null);
    await load();
  }

  async function handleDeleteEvent(id: string) {
    setDeletingId(id);
    try {
      await deleteCalendarEvent(id);
      await load();
    } finally {
      setDeletingId(null);
    }
  }

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
            {syncMessage ??
              `${monthEventCount} event${monthEventCount === 1 ? "" : "s"} this month · ${formatLastSync(lastSyncAt)}`}
          </span>
        </div>
        <div className="calendar-page__controls">
          <button
            type="button"
            className="calendar-add-btn"
            aria-label="Add event"
            onClick={() => openComposer()}
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
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
            title="Optional: pull events from Google Calendar"
            onClick={() => void handleSync()}
            disabled={syncing}
          >
            <RefreshCw
              size={20}
              className={syncing ? "calendar-sync-btn__spin" : undefined}
            />
            <span>{syncing ? "Syncing" : "Google"}</span>
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
                    className={`calendar-chip${
                      ev.allDay ? " calendar-chip--allday" : ""
                    }${isGoogleEvent(ev) ? " calendar-chip--google" : " calendar-chip--desk"}`}
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
          onClick={() => {
            setSelectedDay(null);
            setComposerDay(null);
          }}
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
              <div className="calendar-day-sheet__header-actions">
                <button
                  type="button"
                  className="calendar-day-sheet__add"
                  onClick={() => openComposer(selectedDay)}
                >
                  <Plus size={18} /> Add
                </button>
                <button
                  type="button"
                  className="calendar-day-sheet__close"
                  aria-label="Close"
                  onClick={() => {
                    setSelectedDay(null);
                    setComposerDay(null);
                  }}
                >
                  <X size={22} />
                </button>
              </div>
            </header>
            {composerDay === selectedDay && (
              <div className="calendar-day-sheet__composer">
                <CalendarEventComposer
                  dayKey={selectedDay}
                  onSave={(draft) => handleCreateEvent(selectedDay, draft)}
                  onCancel={() => setComposerDay(null)}
                />
              </div>
            )}
            {selectedEvents.length === 0 && composerDay !== selectedDay ? (
              <div className="calendar-day-sheet__empty-wrap">
                <p className="calendar-day-sheet__empty">No events</p>
                <button
                  type="button"
                  className="calendar-day-sheet__empty-cta action-card action-card--primary"
                  onClick={() => openComposer(selectedDay)}
                >
                  Add event
                </button>
              </div>
            ) : selectedEvents.length > 0 ? (
              <ul className="calendar-day-sheet__list">
                {selectedEvents.map((ev, i) => (
                  <li key={`${ev.id}-${i}`} className="calendar-event-row">
                    <span className="calendar-event-row__time">
                      {formatEventTime(ev)}
                    </span>
                    <span className="calendar-event-row__body">
                      <span className="calendar-event-row__title">
                        {ev.title}
                        {isGoogleEvent(ev) && (
                          <span className="calendar-event-row__badge">Google</span>
                        )}
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
                    <button
                      type="button"
                      className="calendar-event-row__delete"
                      aria-label={`Remove ${ev.title}`}
                      disabled={deletingId === ev.id}
                      onClick={() => void handleDeleteEvent(ev.id)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
