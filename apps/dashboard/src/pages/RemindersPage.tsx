import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import type { Reminder } from "@concierge/shared";
import {
  createReminder,
  dismissReminder,
  fetchReminders,
} from "../api";
import ReminderComposer from "../components/ReminderComposer";
import ReminderEditSheet from "../components/ReminderEditSheet";
import {
  formatReminderDue,
  getReminderDueTone,
  getReminderFilterCategory,
  type ReminderFilter,
} from "../utils/format";

const FILTERS: Array<{ id: ReminderFilter; label: string }> = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "no-date", label: "No Date" },
];

function defaultFilter(reminders: Reminder[]): ReminderFilter {
  const hasOverdue = reminders.some(
    (r) => getReminderFilterCategory(r.dueAt) === "overdue",
  );
  return hasOverdue ? "overdue" : "today";
}

export default function RemindersPage() {
  const [params, setParams] = useSearchParams();
  const highlightId = params.get("id");

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filter, setFilter] = useState<ReminderFilter>("today");
  const [filterInitialized, setFilterInitialized] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [editReminder, setEditReminder] = useState<Reminder | null>(null);
  const [dismissingId, setDismissingId] = useState<number | null>(null);

  const rowRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  const load = useCallback(async () => {
    try {
      const data = await fetchReminders();
      setReminders(data);
      if (!filterInitialized) {
        setFilter(defaultFilter(data));
        setFilterInitialized(true);
      }
    } catch {
      setReminders([]);
    }
  }, [filterInitialized]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      reminders.filter(
        (r) => getReminderFilterCategory(r.dueAt) === filter,
      ),
    [reminders, filter],
  );

  const counts = useMemo(() => {
    const c: Record<ReminderFilter, number> = {
      overdue: 0,
      today: 0,
      upcoming: 0,
      "no-date": 0,
    };
    for (const r of reminders) {
      c[getReminderFilterCategory(r.dueAt)] += 1;
    }
    return c;
  }, [reminders]);

  useEffect(() => {
    if (!highlightId || filtered.length === 0) return;
    const id = Number(highlightId);
    if (!Number.isFinite(id)) return;
    const cat = reminders.find((r) => r.id === id);
    if (cat) {
      setFilter(getReminderFilterCategory(cat.dueAt));
    }
    const t = window.setTimeout(() => {
      const el = rowRefs.current.get(id);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      el?.classList.add("reminders-row--highlight");
      window.setTimeout(() => el?.classList.remove("reminders-row--highlight"), 2000);
    }, 100);
    return () => window.clearTimeout(t);
  }, [highlightId, filtered.length, reminders]);

  async function handleCreate(text: string, dueAt?: string) {
    await createReminder({ text, dueAt, source: "dashboard" });
    setShowComposer(false);
    await load();
    if (dueAt) {
      setFilter(getReminderFilterCategory(dueAt));
    } else {
      setFilter("no-date");
    }
  }

  async function handleDone(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setDismissingId(id);
    try {
      await dismissReminder(id);
      await load();
      if (highlightId === String(id)) {
        setParams({});
      }
    } finally {
      setDismissingId(null);
    }
  }

  return (
    <div className="app-kiosk reminders-page">
      <header className="reminders-page__header">
        <h1 className="reminders-page__title">Reminders</h1>
        <button
          type="button"
          className="reminders-page__add"
          aria-label="Add reminder"
          onClick={() => {
            setShowComposer(true);
            setEditReminder(null);
          }}
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      </header>

      <div className="reminders-page__filters" role="tablist" aria-label="Filter reminders">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={`reminders-filter${filter === id ? " reminders-filter--active" : ""}`}
            onClick={() => setFilter(id)}
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
              {filter === "overdue"
                ? "Nothing overdue"
                : filter === "today"
                  ? "Nothing due today"
                  : filter === "upcoming"
                    ? "Nothing upcoming"
                    : "No reminders without a date"}
            </p>
            {!showComposer && (
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
              const dueLabel = formatReminderDue(r.dueAt);
              return (
                <li
                  key={r.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(r.id, el);
                    else rowRefs.current.delete(r.id);
                  }}
                  className="reminders-row"
                >
                  <button
                    type="button"
                    className="reminders-row__body"
                    onClick={() => {
                      setEditReminder(r);
                      setShowComposer(false);
                    }}
                  >
                    <span
                      className={`reminders-row__dot reminders-row__dot--${tone}`}
                      aria-hidden
                    />
                    <span className="reminders-row__content">
                      <span className="reminders-row__title">{r.text}</span>
                      <span
                        className={`reminders-row__due reminders-row__due--${tone}`}
                      >
                        {dueLabel}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="reminders-row__done"
                    aria-label={`Done: ${r.text}`}
                    disabled={dismissingId === r.id}
                    onClick={(e) => void handleDone(r.id, e)}
                  >
                    {dismissingId === r.id ? "…" : "Done"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ReminderEditSheet
        reminder={editReminder}
        onClose={() => setEditReminder(null)}
        onSaved={() => void load()}
      />
    </div>
  );
}
