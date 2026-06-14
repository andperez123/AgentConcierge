import { Link, useNavigate } from "react-router-dom";
import { Calendar, ChevronRight } from "lucide-react";
import type { Reminder } from "@concierge/shared";
import type { AppMode } from "../context/AppPrefsContext";
import { formatReminderDue } from "../utils/format";

interface Props {
  reminders: Reminder[];
  mode?: AppMode;
}

export default function RemindersPanel({ reminders, mode = "work" }: Props) {
  const navigate = useNavigate();
  const shown = reminders.slice(0, 8);
  const title = mode === "work" ? "Goals" : "Reminders";
  const empty = mode === "work" ? "No work goals" : "No reminders";
  const footer = mode === "work" ? "All goals" : "All reminders";

  return (
    <article className="dash-card">
      <header className="dash-card__header">
        <Calendar size={18} />
        <span>{title}</span>
      </header>
      {shown.length === 0 ? (
        <p className="reminder-empty">{empty}</p>
      ) : (
        <ul className="reminder-list">
          {shown.map((r, i) => {
            const dueLabel = formatReminderDue(r.dueAt);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className="reminder-item reminder-item--tappable"
                  onClick={() => navigate(`/reminders/${r.id}`)}
                >
                  <span
                    className={`reminder-item__dot reminder-item__dot--${i % 2 === 0 ? "accent" : "blue"}`}
                  />
                  <div className="reminder-item__main">
                    <div className="reminder-item__title">{r.text}</div>
                  </div>
                  <span className="reminder-item__time">{dueLabel}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <footer className="dash-card__footer">
        <Link to="/reminders" className="dash-card__footer-btn">
          {footer}
          <ChevronRight size={16} />
        </Link>
      </footer>
    </article>
  );
}
