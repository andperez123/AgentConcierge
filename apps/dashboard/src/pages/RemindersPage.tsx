import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import type { Reminder } from "@concierge/shared";
import {
  createReminder,
  dismissReminder,
  fetchReminders,
} from "../api";
import ReminderComposer from "../components/ReminderComposer";
import {
  formatReminderDue,
  getReminderDueTone,
  getReminderFilterCategory,
  type ReminderFilter,
} from "../utils/format";

type RemindersTab = ReminderFilter | "completed";

const FILTERS: Array<{ id: RemindersTab; label: string }> = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "no-date", label: "No Date" },
  { id: "completed", label: "Completed" },
];

function defaultFilter(reminders: Reminder[]): ReminderFilter {
  const hasOverdue = reminders.some(
    (r) => getReminderFilterCategory(r.dueAt) === "overdue",
  );
  return hasOverdue ? "overdue" : "today";
}

export default function RemindersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const highlightId = params.get("id");

  const [filter, setFilter] = useState<RemindersTab>(
    tabParam === "completed" ? "completed" : "today",
  );
  const [filterInitialized, setFilterInitialized] = useState(
    tabParam === "completed",
  );
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [dismissingId, setDismissingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchReminders({
        status: filter === "completed" ? "completed" : "active",
      });
      setReminders(data);
      if (!filterInitialized && filter !== "completed") {
        setFilter(defaultFilter(data));
        setFilterInitialized(true);
      }
    } catch {
      setReminders([]);
    }
  }, [filter, filterInitialized]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tabParam === "completed") {
      setFilter("completed");
    }
  }, [tabParam]);

  useEffect(() => {
    if (highlightId && /^\d+$/.test(highlightId)) {
      navigate(`/reminders/${highlightId}`, { replace: true });
    }
  }, [highlightId, navigate]);

  const filtered = useMemo(() => {
    if (filter === "completed") return reminders;
    return reminders.filter(
      (r) => getReminderFilterCategory(r.dueAt) === filter,
    );
  }, [reminders, filter]);

  const counts = useMemo(() => {
    const c: Record<RemindersTab, number> = {
      overdue: 0,
      today: 0,
      upcoming: 0,
      "no-date": 0,
      completed: 0,
    };
    if (filter === "completed") {
      c.completed = reminders.length;
      return c;
    }
    for (const r of reminders) {
      c[getReminderFilterCategory(r.dueAt)] += 1;
    }
    return c;
  }, [reminders, filter]);

  function selectFilter(next: RemindersTab) {
    setFilter(next);
    if (next === "completed") {
      setParams({ tab: "completed" });
    } else {
      setParams({});
    }
    setShowComposer(false);
  }

  async function handleCreate(text: string, dueAt?: string) {
    const created = await createReminder({ text, dueAt, source: "dashboard" });
    setShowComposer(false);
    navigate(`/reminders/${created.id}`);
  }

  async function handleDone(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setDismissingId(id);
    try {
      await dismissReminder(id);
      await load();
    } finally {
      setDismissingId(null);
    }
  }

  return (
    <div className="app-kiosk reminders-page">
      <header className="reminders-page__header">
        <h1 className="reminders-page__title">Reminders</h1>
        {filter !== "completed" && (
          <button
            type="button"
            className="reminders-page__add"
            aria-label="Add reminder"
            onClick={() => setShowComposer(true)}
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        )}
      </header>

      <div
        className="reminders-page__filters reminders-page__filters--5"
        role="tablist"
        aria-label="Filter reminders"
      >
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={`reminders-filter${filter === id ? " reminders-filter--active" : ""}`}
            onClick={() => selectFilter(id)}
          >
            <span className="reminders-filter__label">{label}</span>
            {counts[id] > 0 && (
              <span className="reminders-filter__count">{counts[id]}</span>
            )}
          </button>
        ))}
      </div>

      {showComposer && (
        <div className="reminders-page__composer-wrap">
          <ReminderComposer
            onSave={handleCreate}
            onCancel={() => setShowComposer(false)}
          />
        </div>
      )}

      <div className="reminders-page__list-wrap">
        {filtered.length === 0 ? (
          <div className="reminders-page__empty">
            <p className="reminders-page__empty-text">
              {filter === "completed"
                ? "Nothing completed yet"
                : filter === "overdue"
                  ? "Nothing overdue"
                  : filter === "today"
                    ? "Nothing due today"
                    : filter === "upcoming"
                      ? "Nothing upcoming"
                      : "No reminders without a date"}
            </p>
            {filter !== "completed" && !showComposer && (
              <button
                type="button"
                className="reminders-page__empty-cta action-card action-card--primary"
                onClick={() => setShowComposer(true)}
              >
                Add reminder
              </button>
            )}
          </div>
        ) : (
          <ul className="reminders-page__list">
            {filtered.map((r) => {
              const tone = getReminderDueTone(r.dueAt);
              const dueLabel =
                filter === "completed" && r.dismissedAt
                  ? `Completed ${new Date(r.dismissedAt).toLocaleDateString()}`
                  : formatReminderDue(r.dueAt);
              return (
                <li key={r.id} className="reminders-row">
                  <button
                    type="button"
                    className="reminders-row__body"
                    onClick={() => navigate(`/reminders/${r.id}`)}
                  >
                    <span
                      className={`reminders-row__dot reminders-row__dot--${filter === "completed" ? "none" : tone}`}
                      aria-hidden
                    />
                    <span className="reminders-row__content">
                      <span className="reminders-row__title">{r.text}</span>
                      <span
                        className={`reminders-row__due reminders-row__due--${filter === "completed" ? "none" : tone}`}
                      >
                        {dueLabel}
                      </span>
                    </span>
                  </button>
                  {filter !== "completed" && (
                    <button
                      type="button"
                      className="reminders-row__done"
                      aria-label={`Done: ${r.text}`}
                      disabled={dismissingId === r.id}
                      onClick={(e) => void handleDone(r.id, e)}
                    >
                      {dismissingId === r.id ? "…" : "Done"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
