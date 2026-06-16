import { useState } from "react";

const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

export interface CalendarEventDraft {
  title: string;
  allDay: boolean;
  /** HH:MM (24h) when not all-day */
  time: string;
  location?: string;
}

interface Props {
  dayKey: string;
  onSave: (draft: CalendarEventDraft) => Promise<void>;
  onCancel: () => void;
}

function formatDayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function CalendarEventComposer({
  dayKey,
  onSave,
  onCancel,
}: Props) {
  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState("09:00");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onSave({
        title: trimmed,
        allDay,
        time,
        location: location.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="calendar-composer">
      <p className="calendar-composer__day">{formatDayLabel(dayKey)}</p>
      <input
        type="text"
        className="calendar-composer__title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Event title"
        autoFocus
      />
      <label className="calendar-composer__allday">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
        />
        All day
      </label>
      {!allDay && (
        <div className="calendar-composer__times">
          {HOURS.map((h) => {
            const value = `${String(h).padStart(2, "0")}:00`;
            const label =
              h === 0
                ? "12 AM"
                : h < 12
                  ? `${h} AM`
                  : h === 12
                    ? "12 PM"
                    : `${h - 12} PM`;
            return (
              <button
                key={h}
                type="button"
                className={`calendar-composer__time${time === value ? " calendar-composer__time--active" : ""}`}
                onClick={() => setTime(value)}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      <input
        type="text"
        className="calendar-composer__location"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location (optional)"
      />
      <div className="calendar-composer__actions">
        <button
          type="button"
          className="calendar-composer__cancel"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="calendar-composer__save action-card action-card--primary"
          disabled={!title.trim() || busy}
          onClick={() => void handleSave()}
        >
          {busy ? "Saving…" : "Add event"}
        </button>
      </div>
    </div>
  );
}

export function draftToEventInput(
  dayKey: string,
  draft: CalendarEventDraft,
): {
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  location?: string;
} {
  if (draft.allDay) {
    return {
      title: draft.title,
      start: dayKey,
      allDay: true,
      location: draft.location,
    };
  }
  const [h, m] = draft.time.split(":").map(Number);
  const [y, mo, d] = dayKey.split("-").map(Number);
  const start = new Date(y, mo - 1, d, h, m, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return {
    title: draft.title,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    location: draft.location,
  };
}
