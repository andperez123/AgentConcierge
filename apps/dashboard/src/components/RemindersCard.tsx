import type { Reminder } from "@concierge/shared";

function formatDue(dueAt?: string): string | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  const now = new Date();
  if (due < now) return "Overdue";
  return due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface Props {
  reminders: Reminder[];
  onDismiss: (id: number) => void;
  compact?: boolean;
}

export default function RemindersCard({
  reminders,
  onDismiss,
  compact,
}: Props) {
  if (reminders.length === 0) return null;
  const shown = compact ? reminders.slice(0, 2) : reminders;

  return (
    <div className={`feed-card${compact ? " feed-card--compact" : ""}`}>
      <div className="feed-card__title">Reminders</div>
      <ul className="feed-list">
        {shown.map((r) => {
          const due = formatDue(r.dueAt);
          const overdue = due === "Overdue";
          return (
            <li key={r.id} className="feed-item">
              <button
                type="button"
                className="feed-item__body"
                onClick={() => void onDismiss(r.id)}
              >
                <span className="feed-item__text">{r.text}</span>
                {due && (
                  <span
                    className={`feed-item__meta ${overdue ? "feed-item__meta--overdue" : ""}`}
                  >
                    {due}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {!compact && <p className="feed-card__hint">Tap to dismiss</p>}
    </div>
  );
}
