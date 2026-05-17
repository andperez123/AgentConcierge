import { useCallback, useEffect, useState } from "react";
import { dismissNote, fetchNotes } from "../api";
import type { Note } from "@concierge/shared";

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);

  const load = useCallback(async () => {
    try {
      setNotes(await fetchNotes());
    } catch {
      setNotes([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dismiss = useCallback(
    async (id: number) => {
      await dismissNote(id);
      await load();
    },
    [load],
  );

  return (
    <div className="page-shell">
      <h1 className="page-title">Notes</h1>
      <p className="page-subtitle">Tap to dismiss</p>
      {notes.length === 0 ? (
        <p className="reminder-empty">No notes on the desk</p>
      ) : (
        <ul className="list-page-items">
          {notes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className="list-page-item"
                onClick={() => void dismiss(n.id)}
              >
                {n.text}
                {n.source && (
                  <span className="list-page-item__meta">{n.source}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
