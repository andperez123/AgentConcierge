import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Pin, Plus } from "lucide-react";
import type { Note } from "@concierge/shared";
import { createNote, dismissNote, fetchNotes } from "../api";
import NoteComposer from "../components/NoteComposer";

type NoteFilter = "all" | "pinned" | "completed";

const FILTERS: Array<{ id: NoteFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "pinned", label: "Pinned" },
  { id: "completed", label: "Completed" },
];

export default function NotesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const filter: NoteFilter =
    tabParam === "completed" || tabParam === "pinned" ? tabParam : "all";

  const [notes, setNotes] = useState<Note[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [dismissingId, setDismissingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchNotes({
        status: filter === "completed" ? "completed" : "active",
      });
      setNotes(data);
    } catch {
      setNotes([]);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "pinned") {
      return notes.filter((n) => n.pinned);
    }
    return notes;
  }, [notes, filter]);

  const counts = useMemo(() => {
    const active = filter === "completed" ? [] : notes;
    return {
      all: active.length,
      pinned: active.filter((n) => n.pinned).length,
      completed: filter === "completed" ? notes.length : 0,
    };
  }, [notes, filter]);

  useEffect(() => {
    const legacyId = params.get("id");
    if (legacyId && /^\d+$/.test(legacyId)) {
      navigate(`/notes/${legacyId}`, { replace: true });
    }
  }, [params, navigate]);

  function setFilter(next: NoteFilter) {
    if (next === "all") {
      setParams({});
    } else {
      setParams({ tab: next });
    }
    setShowComposer(false);
  }

  async function handleCreate(text: string) {
    await createNote({ text, source: "dashboard" });
    setShowComposer(false);
    await load();
  }

  async function handleDone(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setDismissingId(id);
    try {
      await dismissNote(id);
      await load();
    } finally {
      setDismissingId(null);
    }
  }

  return (
    <div className="app-kiosk reminders-page notes-page">
      <header className="reminders-page__header">
        <h1 className="reminders-page__title">Notes</h1>
        {filter !== "completed" && (
          <button
            type="button"
            className="reminders-page__add"
            aria-label="Add note"
            onClick={() => setShowComposer(true)}
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        )}
      </header>

      <div className="reminders-page__filters" role="tablist" aria-label="Filter notes">
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
          <NoteComposer
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
                : filter === "pinned"
                  ? "No pinned notes"
                  : "No notes yet"}
            </p>
            {filter !== "completed" && !showComposer && (
              <button
                type="button"
                className="reminders-page__empty-cta action-card action-card--primary"
                onClick={() => setShowComposer(true)}
              >
                Add note
              </button>
            )}
          </div>
        ) : (
          <ul className="reminders-page__list">
            {filtered.map((n) => (
              <li key={n.id} className="reminders-row">
                <button
                  type="button"
                  className="reminders-row__body"
                  onClick={() => navigate(`/notes/${n.id}`)}
                >
                  <span
                    className={`reminders-row__dot reminders-row__dot--${n.pinned ? "today" : "none"}`}
                    aria-hidden
                  />
                  <span className="reminders-row__content">
                    <span className="reminders-row__title">
                      {n.pinned && (
                        <Pin
                          size={14}
                          style={{ display: "inline", marginRight: 6 }}
                        />
                      )}
                      {n.text}
                    </span>
                    <span className="reminders-row__due">
                      {filter === "completed" && n.dismissedAt
                        ? `Completed ${new Date(n.dismissedAt).toLocaleDateString()}`
                        : new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                </button>
                {filter !== "completed" && (
                  <button
                    type="button"
                    className="reminders-row__done"
                    aria-label={`Done: ${n.text}`}
                    disabled={dismissingId === n.id}
                    onClick={(e) => void handleDone(n.id, e)}
                  >
                    {dismissingId === n.id ? "…" : "Done"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
