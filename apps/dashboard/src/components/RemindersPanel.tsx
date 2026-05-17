import { Link } from "react-router-dom";
import { Calendar, ChevronRight } from "lucide-react";
import type { Reminder } from "@concierge/shared";
import { formatReminderTime } from "../utils/format";

interface Props {
  reminders: Reminder[];
}

export default function RemindersPanel({ reminders }: Props) {
  const shown = reminders.slice(0, 4);

  return (
    <article className="dash-card">
      <header className="dash-card__header">
        <Calendar size={18} />
        <span>Today&apos;s Reminders</span>
      </header>
      {shown.length === 0 ? (
        <p className="reminder-empty">No reminders for today</p>
      ) : (
        <ul className="reminder-list">
          {shown.map((r, i) => {
            const time = formatReminderTime(r.dueAt);
            return (
              <li key={r.id} className="reminder-item">
                <span
                  className={`reminder-item__dot reminder-item__dot--${i % 2 === 0 ? "accent" : "blue"}`}
                />
                <div>
                  <div className="reminder-item__title">{r.text}</div>
                  {r.source && (
                    <div className="reminder-item__sub">{r.source}</div>
                  )}
                </div>
                {time && <span className="reminder-item__time">{time}</span>}
              </li>
            );
          })}
        </ul>
      )}
      <footer className="dash-card__footer">
        <Link to="/reminders" className="dash-card__footer-btn">
          View all reminders
          <ChevronRight size={16} />
        </Link>
      </footer>
    </article>
  );
}
