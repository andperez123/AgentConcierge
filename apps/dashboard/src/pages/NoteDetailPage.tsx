import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Note } from "@concierge/shared";
import { fetchNote } from "../api";
import DeskItemDetail from "../components/DeskItemDetail";

export default function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const numId = Number(id);
    if (!Number.isFinite(numId)) {
      setError("Invalid note");
      return;
    }
    try {
      setNote(await fetchNote(numId));
      setError(null);
    } catch {
      setNote(null);
      setError("Note not found");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="app-kiosk desk-detail">
        <p className="desk-detail__error">{error}</p>
        <button
          type="button"
          className="action-card action-card--secondary"
          onClick={() => navigate("/notes")}
        >
          Back to notes
        </button>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="app-kiosk desk-detail">
        <p className="reminder-empty">Loading…</p>
      </div>
    );
  }

  return (
    <DeskItemDetail kind="note" item={note} onChanged={() => void load()} />
  );
}
