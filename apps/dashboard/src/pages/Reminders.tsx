import { useCallback, useEffect, useState } from "react";
import { dismissReminder, fetchReminders } from "../api";
import type { Reminder } from "@concierge/shared";
import { formatReminderTime } from "../utils/format";

export default function Reminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const load = useCallback(async () => {
    try {
      setReminders(await fetchReminders());
    } catch {
      setReminders([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dismiss = useCallback(
    async (id: number) => {
      await dismissReminder(id);
      await load();
    },
    [load],
  );

  return (
    <div className="page-shell">
      <h1 className="page-title">Reminders</h1>
      <p className="page-subtitle">Tap to dismiss</p>
      {reminders.length === 0 ? (
        <p className="reminder-empty">No active reminders</p>
      ) : (
        <ul className="list-page-items">
          {reminders.map((r) => {
            const time = formatReminderTime(r.dueAt);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className="list-page-item"
                  onClick={() => void dismiss(r.id)}
                >
                  {r.text}
                  <span className="list-page-item__meta">
                    {[r.source, time].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
