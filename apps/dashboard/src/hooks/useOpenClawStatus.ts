import { useCallback, useEffect, useState } from "react";
import type { OpenClawStatus } from "@concierge/shared";
import { fetchOpenClawStatus } from "../api";

export function useOpenClawStatus(intervalMs = 5000, enabled = true) {
  const [status, setStatus] = useState<OpenClawStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (force = false) => {
    try {
      const data = await fetchOpenClawStatus(force);
      setStatus(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs, enabled]);

  return { status, error, loading, refresh };
}
