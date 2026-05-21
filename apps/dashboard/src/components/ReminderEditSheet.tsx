import { useEffect, useState } from "react";
import type { Reminder } from "@concierge/shared";
import { updateReminder } from "../api";
import DueTimePicker from "./DueTimePicker";

interface Props {
  reminder: Reminder | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ReminderEditSheet({
  reminder,
  onClose,
  onSaved,
}: Props) {
  const [text, setText] = useState("");
  const [dueAt, setDueAt] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reminder) return;
    setText(reminder.text);
    setDueAt(reminder.dueAt);
    setError(null);
  }, [reminder]);

  if (!reminder) return null;

  const editing = reminder;

  async function save() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await updateReminder(editing.id, {
        text: trimmed,
        dueAt: dueAt ?? null,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="reminder-edit-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-edit-title"
      >
        <h2 id="reminder-edit-title" className="reminder-edit-sheet__title">
          Edit reminder
        </h2>
        <textarea
          className="reminder-composer__text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        <DueTimePicker value={dueAt} onChange={setDueAt} />
        {error && <p className="reminder-edit-sheet__error">{error}</p>}
        <div className="reminder-composer__actions">
          <button
            type="button"
            className="reminder-composer__cancel"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="reminder-composer__save action-card action-card--primary"
            disabled={!text.trim() || busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
