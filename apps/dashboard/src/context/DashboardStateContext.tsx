import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DashboardCommand, DashboardState } from "@concierge/shared";
import { fetchDashboardState } from "../api";
import { useAppPrefs } from "./AppPrefsContext";

const POLL_MS = 5000;
const POLL_FALLBACK_MS = 30000;

type CommandListener = (
  cmd: DashboardCommand & { commandId?: string },
) => void;

interface DashboardStateContextValue {
  state: DashboardState | null;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
  sseConnected: boolean;
  subscribeCommands: (listener: CommandListener) => () => void;
}

const DashboardStateContext = createContext<DashboardStateContextValue | null>(
  null,
);

export function DashboardStateProvider({ children }: { children: ReactNode }) {
  const { mode } = useAppPrefs();
  const [state, setState] = useState<DashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const commandListeners = useRef(new Set<CommandListener>());
  const modeRef = useRef(mode);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const refresh = useCallback(async (force = false) => {
    try {
      const data = await fetchDashboardState(force, modeRef.current);
      setState(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dashboard unavailable");
    }
  }, []);

  const subscribeCommands = useCallback((listener: CommandListener) => {
    commandListeners.current.add(listener);
    return () => {
      commandListeners.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    void refresh(true);
  }, [mode, refresh]);

  useEffect(() => {
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
      es.addEventListener("command", (ev) => {
        try {
          const cmd = JSON.parse(ev.data) as DashboardCommand & {
            commandId?: string;
          };
          for (const listener of commandListeners.current) {
            listener(cmd);
          }
        } catch {
          /* ignore malformed command payloads */
        }
      });
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
  }, [refresh]);

  const value: DashboardStateContextValue = {
    state,
    error,
    refresh,
    sseConnected,
    subscribeCommands,
  };

  return (
    <DashboardStateContext.Provider value={value}>
      {children}
    </DashboardStateContext.Provider>
  );
}

export function useDashboardStateContext(): DashboardStateContextValue {
  const ctx = useContext(DashboardStateContext);
  if (!ctx) {
    throw new Error(
      "useDashboardStateContext must be used within DashboardStateProvider",
    );
  }
  return ctx;
}
