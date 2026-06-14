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
import { useAppPrefs } from "../context/AppPrefsContext";
import { formatReminderTime } from "../utils/format";
import { formatProjectMeta } from "../utils/projectFormat";

type Tab = "all" | "reminders" | "notes" | "projects";

export default function Work() {
  const navigate = useNavigate();
  const { mode } = useAppPrefs();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "all";

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<OpenClawProject[]>([]);
  const [createKind, setCreateKind] = useState<"reminder" | "note" | null>(null);
  const [draft, setDraft] = useState("");
  const [dueAt, setDueAt] = useState("");

  const isWork = mode === "work";
  const pageTitle = isWork ? "Work" : "Life";
  const remindersLabel = isWork ? "Goals" : "Reminders";

  const load = useCallback(async () => {
    try {
      const context = mode;
      const [r, n, p] = await Promise.all([
        fetchReminders({ context }),
        fetchNotes({ context }),
        isWork ? fetchProjects() : Promise.resolve([] as OpenClawProject[]),
      ]);
      setReminders(r);
      setNotes(n);
      setProjects(p);
    } catch {
      setReminders([]);
      setNotes([]);
      setProjects([]);
    }
  }, [mode, isWork]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isWork && tab === "projects") {
      setParams({});
    }
  }, [isWork, tab, setParams]);

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

  const listItems =
    tab === "reminders"
      ? reminders.map((r) => ({ type: "reminder" as const, item: r }))
      : tab === "notes"
        ? notes.map((n) => ({ type: "note" as const, item: n }))
        : combined;

  const isEmpty =
    tab === "projects"
      ? projects.length === 0
      : listItems.length === 0;

  function setTab(next: Tab) {
    setParams(next === "all" ? {} : { tab: next });
    setCreateKind(null);
  }

  async function submitCreate() {
    const text = draft.trim();
    if (!text || !createKind) return;
    const context = mode;
    if (createKind === "reminder") {
      const created = await createReminder({
        text,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        source: "dashboard",
        context,
      });
      navigate(`/reminders/${created.id}`);
    } else {
      const created = await createNote({ text, source: "dashboard", context });
      navigate(`/notes/${created.id}`);
    }
    setDraft("");
    setDueAt("");
    setCreateKind(null);
    await load();
  }

  function openItem(entry: { type: "reminder" | "note"; item: Reminder | Note }) {
    if (entry.type === "reminder") {
      navigate(`/reminders/${entry.item.id}`);
    } else {
      navigate(`/notes/${entry.item.id}`);
    }
    setCreateKind(null);
  }

  const tabs: Array<[Tab, string]> = isWork
    ? [
        ["all", "All"],
        ["reminders", remindersLabel],
        ["notes", "Notes"],
        ["projects", "Projects"],
      ]
    : [
        ["all", "All"],
        ["reminders", remindersLabel],
        ["notes", "Notes"],
      ];

  return (
    <div className="page-shell page-shell--work">
      <header className="page-shell__header">
        <h1 className="page-title">{pageTitle}</h1>
        <p className="page-subtitle">
          {isWork
            ? "Goals, notes, and projects for work"
            : "Personal reminders and notes"}
        </p>
        <nav className="work-tabs" aria-label="Work sections">
          {tabs.map(([id, label]) => (
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
              + {isWork ? "Goal" : "Reminder"}
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
                createKind === "reminder"
                  ? isWork
                    ? "New work goal…"
                    : "New reminder…"
                  : "New note…"
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
        {isEmpty ? (
          <div className="work-empty">
            <p className="work-empty__text">
              {isWork
                ? tab === "projects"
                  ? "No projects in ~/clawd/projects"
                  : "No work goals yet. Create a goal or ask the agent to plan your work."
                : "No life items yet. Add reminders, habits, or personal notes."}
            </p>
          </div>
        ) : tab === "projects" ? (
          <ul className="work-project-list">
            {projects.map((p) => (
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
            ))}
          </ul>
        ) : (
          <ul className="list-page-items">
            {listItems.map((entry) => {
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
                    onClick={() => openItem(entry)}
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
    </div>
  );
}
