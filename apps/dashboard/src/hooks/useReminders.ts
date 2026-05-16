import { useCallback, useEffect, useState } from "react";
import type { Reminder } from "@concierge/shared";
import { dismissReminder, fetchReminders } from "../api";

const POLL_MS = 10_000;

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchReminders();
      setReminders(data.slice(0, 5));
    } catch {
      setReminders([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const dismiss = useCallback(
    async (id: number) => {
      await dismissReminder(id);
      await refresh();
    },
    [refresh],
  );

  return { reminders, refresh, dismiss };
}
