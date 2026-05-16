import { useCallback, useEffect, useState } from "react";
import type { DashboardState } from "@concierge/shared";
import { fetchDashboardState } from "../api";

const POLL_MS = 5000;
const POLL_FALLBACK_MS = 30000;

export function useDashboardState(enabled = true, intervalMs = POLL_MS) {
  const [state, setState] = useState<DashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);

  const refresh = useCallback(async (force = false) => {
    try {
      const data = await fetchDashboardState(force);
      setState(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dashboard unavailable");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let pollId: ReturnType<typeof setInterval> | undefined;

    function startPoll(ms: number) {
      if (pollId) clearInterval(pollId);
      pollId = setInterval(() => void refresh(), ms);
    }

    void refresh();
    startPoll(POLL_MS);

    try {
      es = new EventSource("/api/dashboard/events");
      es.addEventListener("connected", () => {
        setSseConnected(true);
        startPoll(POLL_FALLBACK_MS);
      });
      es.addEventListener("state-changed", () => void refresh(true));
      es.addEventListener("operation-updated", () => void refresh());
      es.addEventListener("alert-created", () => void refresh());
      es.addEventListener("alert-updated", () => void refresh());
      es.onerror = () => {
        setSseConnected(false);
        es?.close();
        es = null;
        startPoll(POLL_MS);
      };
    } catch {
      /* polling only */
    }

    return () => {
      es?.close();
      if (pollId) clearInterval(pollId);
    };
  }, [enabled, refresh, intervalMs]);

  return { state, error, refresh, sseConnected };
}
