import { Moon, Sun } from "lucide-react";
import { useAppPrefs } from "../context/AppPrefsContext";

interface Props {
  /** Compact layout for top status row */
  compact?: boolean;
}

export default function ModeThemeControls({ compact = false }: Props) {
  const { theme, mode, toggleTheme, setMode } = useAppPrefs();

  return (
    <div
      className={`mode-theme-controls${compact ? " mode-theme-controls--compact" : ""}`}
      role="group"
      aria-label="Display preferences"
    >
      <div className="mode-switch" role="group" aria-label="Work or Life mode">
        <button
          type="button"
          className={`mode-switch__btn${mode === "work" ? " mode-switch__btn--active" : ""}`}
          onClick={() => setMode("work")}
          aria-pressed={mode === "work"}
        >
          Work
        </button>
        <button
          type="button"
          className={`mode-switch__btn${mode === "life" ? " mode-switch__btn--active" : ""}`}
          onClick={() => setMode("life")}
          aria-pressed={mode === "life"}
        >
          Life
        </button>
      </div>
      <button
        type="button"
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
      >
        {theme === "dark" ? <Sun size={compact ? 18 : 22} /> : <Moon size={compact ? 18 : 22} />}
      </button>
    </div>
  );
}
