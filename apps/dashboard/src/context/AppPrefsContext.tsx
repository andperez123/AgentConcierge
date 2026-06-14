import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppTheme = "light" | "dark";
export type AppMode = "work" | "life";

export interface AppPrefs {
  theme: AppTheme;
  mode: AppMode;
  /** Reserved for future density override (currently auto-detected). */
  density?: "kiosk" | "standard" | "large";
  /** Reserved for distraction-free / agent-focused sessions. */
  focusMode?: boolean;
}

const STORAGE_KEYS = {
  theme: "concierge-theme",
  mode: "concierge-mode",
} as const;

const DEFAULT_PREFS: AppPrefs = {
  theme: "dark",
  mode: "work",
};

function readStoredTheme(): AppTheme {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.theme);
    return v === "light" || v === "dark" ? v : DEFAULT_PREFS.theme;
  } catch {
    return DEFAULT_PREFS.theme;
  }
}

function readStoredMode(): AppMode {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.mode);
    return v === "work" || v === "life" ? v : DEFAULT_PREFS.mode;
  } catch {
    return DEFAULT_PREFS.mode;
  }
}

function applyDomPrefs(theme: AppTheme, mode: AppMode): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.mode = mode;
}

interface AppPrefsContextValue extends AppPrefs {
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  setMode: (mode: AppMode) => void;
}

const AppPrefsContext = createContext<AppPrefsContextValue | null>(null);

export function AppPrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(readStoredTheme);
  const [mode, setModeState] = useState<AppMode>(readStoredMode);

  useEffect(() => {
    applyDomPrefs(theme, mode);
    try {
      localStorage.setItem(STORAGE_KEYS.theme, theme);
      localStorage.setItem(STORAGE_KEYS.mode, mode);
    } catch {
      /* ignore storage errors */
    }
  }, [theme, mode]);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
  }, []);

  const value = useMemo<AppPrefsContextValue>(
    () => ({
      theme,
      mode,
      setTheme,
      toggleTheme,
      setMode,
    }),
    [theme, mode, setTheme, toggleTheme, setMode],
  );

  return (
    <AppPrefsContext.Provider value={value}>{children}</AppPrefsContext.Provider>
  );
}

export function useAppPrefs(): AppPrefsContextValue {
  const ctx = useContext(AppPrefsContext);
  if (!ctx) {
    throw new Error("useAppPrefs must be used within AppPrefsProvider");
  }
  return ctx;
}
