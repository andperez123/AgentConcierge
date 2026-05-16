import { useCallback, useEffect, useState } from "react";
import type { Weather } from "@concierge/shared";
import { fetchWeather } from "../api";

const POLL_MS = 30 * 60 * 1000;

export function useWeather(enabled = true) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [needsCity, setNeedsCity] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (force = false) => {
    try {
      const data = await fetchWeather(force);
      setWeather(data);
      setNeedsCity(false);
    } catch (e) {
      setWeather(null);
      setNeedsCity(
        e instanceof Error && e.message === "NO_CITY",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh, enabled]);

  return { weather, needsCity, loading, refresh };
}
