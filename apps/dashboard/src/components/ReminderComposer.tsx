import { useState } from "react";
import DueTimePicker from "./DueTimePicker";

interface Props {
  onSave: (text: string, dueAt?: string) => Promise<void>;
  onCancel: () => void;
}

export default function ReminderComposer({ onSave, onCancel }: Props) {
  const [text, setText] = useState("");
  const [dueAt, setDueAt] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onSave(trimmed, dueAt);
      setText("");
      setDueAt(undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="reminder-composer">
      <textarea
        className="reminder-composer__text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What do you need to remember?"
        rows={3}
        autoFocus
      />
      <DueTimePicker value={dueAt} onChange={setDueAt} />
      <div className="reminder-composer__actions">
        <button
          type="button"
          className="reminder-composer__cancel"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="reminder-composer__save action-card action-card--primary"
          disabled={!text.trim() || busy}
          onClick={() => void handleSave()}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
