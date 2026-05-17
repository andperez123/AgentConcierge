import { useEffect, useState } from "react";
import type { OpenClawProject, WorkEntityActionId } from "@concierge/shared";
import {
  dismissNote,
  dismissReminder,
  postWorkEntityAction,
  updateNote,
  updateReminder,
} from "../api";
import type { WorkItem } from "./workTypes";

export type { WorkItem } from "./workTypes";

interface Props {
  selection: WorkItem | null;
  projects?: OpenClawProject[];
  onClose: () => void;
  onSaved: () => void;
  enableActions?: boolean;
}

const ACTIONS: Array<{ id: WorkEntityActionId; label: string }> = [
  { id: "ask-agent", label: "Ask agent" },
  { id: "export-drive", label: "Save to Drive" },
  { id: "summarize", label: "Summarize" },
  { id: "complete", label: "Complete" },
];

export default function WorkItemSheet({
  selection,
  projects = [],
  onClose,
  onSaved,
  enableActions = false,
}: Props) {
  const [text, setText] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [pinned, setPinned] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selection) return;
    setText(selection.item.text);
    setDueAt(
      selection.kind === "reminder" && selection.item.dueAt
        ? selection.item.dueAt.slice(0, 16)
        : "",
    );
    setPinned(selection.kind === "note" ? Boolean(selection.item.pinned) : false);
    setProjectId(selection.item.projectId ?? "");
    setError(null);
  }, [selection]);

  if (!selection) return null;

  const sel = selection;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (sel.kind === "reminder") {
        await updateReminder(sel.item.id, {
          text,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          projectId: projects.length > 0 ? projectId || null : undefined,
        });
      } else {
        await updateNote(sel.item.id, {
          text,
          pinned,
          projectId: projects.length > 0 ? projectId || null : undefined,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    setBusy(true);
    try {
      if (sel.kind === "reminder") {
        await dismissReminder(sel.item.id);
      } else {
        await dismissNote(sel.item.id);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dismiss failed");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: WorkEntityActionId) {
    setBusy(true);
    setError(null);
    try {
      await postWorkEntityAction(sel.kind, String(sel.item.id), { action });
      onSaved();
      if (action === "complete") onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="work-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="work-sheet__title">
          {sel.kind === "reminder" ? "Reminder" : "Note"}
        </h2>
        <label className="work-sheet__field">
          <span>Text</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
        </label>
        {sel.kind === "reminder" && (
          <label className="work-sheet__field">
            <span>Due</span>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </label>
        )}
        {sel.kind === "note" && (
          <label className="work-sheet__check">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Pinned
          </label>
        )}
        {projects.length > 0 && (
          <label className="work-sheet__field">
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
        {error && <p className="work-sheet__error">{error}</p>}
        {enableActions && (
          <div className="work-sheet__actions">
            {ACTIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                className="work-sheet__action-btn"
                disabled={busy}
                onClick={() => void runAction(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="action-card action-card--secondary"
            disabled={busy}
            onClick={() => void dismiss()}
          >
            Dismiss
          </button>
          <button
            type="button"
            className="action-card action-card--primary"
            disabled={busy || !text.trim()}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
