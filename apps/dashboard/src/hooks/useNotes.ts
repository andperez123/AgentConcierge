import { useCallback, useEffect, useState } from "react";
import type { Note } from "@concierge/shared";
import { dismissNote, fetchNotes } from "../api";

const POLL_MS = 10_000;

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchNotes();
      setNotes(data.slice(0, 3));
    } catch {
      setNotes([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const dismiss = useCallback(
    async (id: number) => {
      await dismissNote(id);
      await refresh();
    },
    [refresh],
  );

  return { notes, refresh, dismiss };
}
