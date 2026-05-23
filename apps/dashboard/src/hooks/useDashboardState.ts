import { useDashboardStateContext } from "../context/DashboardStateContext";

/** Shared dashboard state from AppShell provider (single poll + SSE). */
export function useDashboardState(
  _enabled = true,
  _intervalMs?: number,
) {
  return useDashboardStateContext();
}
