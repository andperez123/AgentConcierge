import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Copy } from "lucide-react";
import type {
  Note,
  OpenClawProject,
  Reminder,
  WorkContext,
  WorkEntityActionId,
} from "@concierge/shared";
import {
  dismissNote,
  dismissReminder,
  fetchProjects,
  postWorkEntityAction,
  updateNote,
  updateReminder,
} from "../api";
import AgentQuickActions from "./AgentQuickActions";
import ContextPicker from "./ContextPicker";
import DueTimePicker from "./DueTimePicker";
import { formatReminderDue, getReminderDueTone } from "../utils/format";

const ACTIONS: Array<{ id: WorkEntityActionId; label: string }> = [
  { id: "ask-agent", label: "Ask agent" },
  { id: "export-drive", label: "Save to Drive" },
  { id: "summarize", label: "Summarize" },
  { id: "complete", label: "Complete" },
];

type Props =
  | { kind: "reminder"; item: Reminder; onChanged?: () => void }
  | { kind: "note"; item: Note; onChanged?: () => void };

export default function DeskItemDetail(props: Props) {
  const navigate = useNavigate();
  const { kind, item, onChanged } = props;
  const completed = Boolean(item.dismissedAt);

  const [text, setText] = useState(item.text);
  const [dueAt, setDueAt] = useState<string | undefined>(
    kind === "reminder" ? item.dueAt : undefined,
  );
  const [pinned, setPinned] = useState(
    kind === "note" ? Boolean(item.pinned) : false,
  );
  const [projectId, setProjectId] = useState(item.projectId ?? "");
  const [itemContext, setItemContext] = useState<WorkContext>(
    item.context ?? null,
  );
  const [projects, setProjects] = useState<OpenClawProject[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    setText(item.text);
    setDueAt(kind === "reminder" ? item.dueAt : undefined);
    setPinned(kind === "note" ? Boolean(item.pinned) : false);
    setProjectId(item.projectId ?? "");
    setItemContext(item.context ?? null);
    setError(null);
  }, [item, kind]);

  useEffect(() => {
    void fetchProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  const listPath = kind === "reminder" ? "/reminders" : "/notes";
  const dueTone = kind === "reminder" ? getReminderDueTone(item.dueAt) : null;

  async function copyText() {
    try {
      await navigator.clipboard.writeText(completed ? item.text : text);
      setCopyFeedback("Copied");
      window.setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback("Copy failed");
    }
  }

  async function save() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "reminder") {
        await updateReminder(item.id, {
          text: trimmed,
          dueAt: dueAt ?? null,
          projectId: projects.length > 0 ? projectId || null : undefined,
          context: itemContext,
        });
      } else {
        await updateNote(item.id, {
          text: trimmed,
          pinned,
          projectId: projects.length > 0 ? projectId || null : undefined,
          context: itemContext,
        });
      }
      setSavedFeedback(true);
      window.setTimeout(() => setSavedFeedback(false), 2000);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function markAccomplished() {
    setBusy(true);
    setError(null);
    try {
      if (kind === "reminder") {
        await dismissReminder(item.id);
      } else {
        await dismissNote(item.id);
      }
      onChanged?.();
      navigate(`${listPath}?tab=completed`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark done");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: WorkEntityActionId) {
    setBusy(true);
    setError(null);
    try {
      await postWorkEntityAction(kind, String(item.id), { action });
      onChanged?.();
      if (action === "complete") {
        navigate(`${listPath}?tab=completed`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const projectName = projects.find((p) => p.id === item.projectId)?.name;

  return (
    <div className="app-kiosk desk-detail">
      <header className="desk-detail__header">
        <button
          type="button"
          className="desk-detail__back"
          onClick={() => navigate(listPath)}
          aria-label="Back to list"
        >
          <ArrowLeft size={22} />
          <span>{kind === "reminder" ? "Reminders" : "Notes"}</span>
        </button>
        <button
          type="button"
          className="desk-detail__copy"
          onClick={() => void copyText()}
          aria-label="Copy text"
        >
          <Copy size={20} />
          {copyFeedback ?? "Copy"}
        </button>
      </header>

      {completed && item.dismissedAt && (
        <div className="desk-detail__banner desk-detail__banner--completed">
          Completed{" "}
          {new Date(item.dismissedAt).toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>
      )}

      {!completed && kind === "reminder" && dueTone && (
        <div className={`desk-detail__banner desk-detail__banner--${dueTone}`}>
          {formatReminderDue(item.dueAt)}
        </div>
      )}

      {!completed && kind === "note" && pinned && (
        <div className="desk-detail__banner desk-detail__banner--pinned">
          Pinned
        </div>
      )}

      <div className="desk-detail__meta">
        <div className="desk-detail__meta-row">
          <span className="desk-detail__meta-label">Created</span>
          <span>
            {new Date(item.createdAt).toLocaleString([], {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>
        {item.source && (
          <div className="desk-detail__meta-row">
            <span className="desk-detail__meta-label">Source</span>
            <span>{item.source}</span>
          </div>
        )}
        {item.projectId && (
          <div className="desk-detail__meta-row">
            <span className="desk-detail__meta-label">Project</span>
            <Link
              to={`/projects/${item.projectId}`}
              className="desk-detail__link"
            >
              {projectName ?? item.projectId}
            </Link>
          </div>
        )}
      </div>

      <div className="desk-detail__body">
        {completed ? (
          <div className="desk-detail__readonly">{item.text}</div>
        ) : (
          <textarea
            className="desk-detail__textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            aria-label={kind === "reminder" ? "Reminder text" : "Note text"}
          />
        )}

        {!completed && kind === "reminder" && (
          <DueTimePicker value={dueAt} onChange={setDueAt} />
        )}

        {!completed && kind === "note" && (
          <label className="desk-detail__check">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Pinned
          </label>
        )}

        {!completed && projects.length > 0 && (
          <label className="desk-detail__field">
            <span>Project</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {!completed && (
          <label className="desk-detail__field">
            <span>Context</span>
            <ContextPicker
              value={itemContext}
              onChange={setItemContext}
              disabled={busy}
            />
          </label>
        )}
      </div>

      {!completed && itemContext === "work" && (
        <AgentQuickActions
          kind={kind}
          id={String(item.id)}
          context={itemContext}
          onComplete={onChanged}
        />
      )}

      {error && <p className="desk-detail__error">{error}</p>}
      {savedFeedback && (
        <p className="desk-detail__saved" role="status">
          Saved
        </p>
      )}

      {!completed && (
        <>
          <div className="desk-detail__actions">
            {ACTIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                className="desk-detail__action-btn"
                disabled={busy}
                onClick={() => void runAction(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>

          <footer className="desk-detail__footer">
            <button
              type="button"
              className="action-card action-card--secondary desk-detail__done-btn"
              disabled={busy}
              onClick={() => void markAccomplished()}
            >
              <Check size={18} />
              Mark accomplished
            </button>
            <button
              type="button"
              className="action-card action-card--primary"
              disabled={busy || !text.trim()}
              onClick={() => void save()}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
