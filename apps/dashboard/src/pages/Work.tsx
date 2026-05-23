import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Note, OpenClawProject, Reminder } from "@concierge/shared";
import {
  createNote,
  createReminder,
  fetchNotes,
  fetchProjects,
  fetchReminders,
} from "../api";
import WorkItemSheet, { type WorkItem } from "../components/WorkItemSheet";
import { formatReminderTime } from "../utils/format";
import { formatProjectMeta } from "../utils/projectFormat";

type Tab = "all" | "reminders" | "notes" | "projects";

export default function Work() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "all";

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<OpenClawProject[]>([]);
  const [selection, setSelection] = useState<WorkItem | null>(null);
  const [createKind, setCreateKind] = useState<"reminder" | "note" | null>(null);
  const [draft, setDraft] = useState("");
  const [dueAt, setDueAt] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, n, p] = await Promise.all([
        fetchReminders(),
        fetchNotes(),
        fetchProjects(),
      ]);
      setReminders(r);
      setNotes(n);
      setProjects(p);
    } catch {
      setReminders([]);
      setNotes([]);
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const combined = useMemo(() => {
    const items: Array<
      | { type: "reminder"; item: Reminder; sort: string }
      | { type: "note"; item: Note; sort: string }
    > = [
      ...reminders.map((r) => ({
        type: "reminder" as const,
        item: r,
        sort: r.dueAt ?? r.createdAt,
      })),
      ...notes.map((n) => ({
        type: "note" as const,
        item: n,
        sort: n.createdAt,
      })),
    ];
    return items.sort((a, b) => b.sort.localeCompare(a.sort));
  }, [reminders, notes]);

  function setTab(next: Tab) {
    setParams(next === "all" ? {} : { tab: next });
    setCreateKind(null);
  }

  async function submitCreate() {
    const text = draft.trim();
    if (!text || !createKind) return;
    if (createKind === "reminder") {
      await createReminder({
        text,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        source: "dashboard",
      });
    } else {
      await createNote({ text, source: "dashboard" });
    }
    setDraft("");
    setDueAt("");
    setCreateKind(null);
    await load();
  }

  function openItem(item: WorkItem) {
    setSelection(item);
    setCreateKind(null);
  }

  return (
    <div className="page-shell page-shell--work">
      <header className="page-shell__header">
        <h1 className="page-title">Work</h1>
        <nav className="work-tabs" aria-label="Work sections">
          {(
            [
              ["all", "All"],
              ["reminders", "Reminders"],
              ["notes", "Notes"],
              ["projects", "Projects"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`work-tabs__btn${tab === id ? " work-tabs__btn--active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        {(tab === "all" || tab === "reminders" || tab === "notes") && (
          <div className="work-create-bar">
            <button
              type="button"
              className="work-create-bar__btn"
              onClick={() => {
                setCreateKind("reminder");
                setDraft("");
                setDueAt("");
              }}
            >
              + Reminder
            </button>
            <button
              type="button"
              className="work-create-bar__btn"
              onClick={() => {
                setCreateKind("note");
                setDraft("");
              }}
            >
              + Note
            </button>
          </div>
        )}

        {createKind && (
          <div className="work-inline-form">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                createKind === "reminder" ? "New reminder…" : "New note…"
              }
              rows={2}
            />
            {createKind === "reminder" && (
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            )}
            <div className="work-inline-form__actions">
              <button type="button" onClick={() => setCreateKind(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="action-card action-card--primary"
                disabled={!draft.trim()}
                onClick={() => void submitCreate()}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="page-shell__body">
        {tab === "projects" ? (
          <ul className="work-project-list">
            {projects.length === 0 ? (
              <p className="reminder-empty">No projects in ~/clawd/projects</p>
            ) : (
              projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="list-page-item"
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    {p.name}
                    <span className="list-page-item__meta list-page-item__meta--truncate">
                      {formatProjectMeta(p)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : (
          <ul className="list-page-items">
            {(tab === "reminders"
              ? reminders.map((r) => ({ type: "reminder" as const, item: r }))
              : tab === "notes"
                ? notes.map((n) => ({ type: "note" as const, item: n }))
                : combined
            ).map((entry) => {
              const key =
                entry.type === "reminder"
                  ? `r-${entry.item.id}`
                  : `n-${entry.item.id}`;
              const time =
                entry.type === "reminder"
                  ? formatReminderTime(entry.item.dueAt)
                  : null;
              return (
                <li key={key}>
                  <button
                    type="button"
                    className="list-page-item"
                    onClick={() =>
                      openItem(
                        entry.type === "reminder"
                          ? { kind: "reminder", item: entry.item }
                          : { kind: "note", item: entry.item },
                      )
                    }
                  >
                    {entry.type === "reminder" ? "⏰ " : "📝 "}
                    {entry.item.text}
                    <span className="list-page-item__meta">
                      {[entry.type, time, entry.item.source]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <WorkItemSheet
        selection={selection}
        projects={projects}
        onClose={() => setSelection(null)}
        onSaved={() => void load()}
        enableActions
      />
    </div>
  );
}
