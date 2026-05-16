import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dismissNote, dismissReminder, postDashboardAction } from "../api";
import ActionStrip from "../components/ActionStrip";
import AttentionCard from "../components/AttentionCard";
import ClockHero from "../components/ClockHero";
import SystemStateCard from "../components/SystemStateCard";
import UtilityRow from "../components/UtilityRow";
import { useDashboardCommands } from "../hooks/useDashboardCommands";
import { useDashboardState } from "../hooks/useDashboardState";

export default function Home() {
  const navigate = useNavigate();
  const { state, error, refresh } = useDashboardState();
  const [toast, setToast] = useState<string | null>(null);
  const [debugTaps, setDebugTaps] = useState(0);
  const [showRestart, setShowRestart] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useDashboardCommands((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  });

  useEffect(() => {
    if (debugTaps >= 5) navigate("/debug");
    if (debugTaps > 0) {
      const t = setTimeout(() => setDebugTaps(0), 2000);
      return () => clearTimeout(t);
    }
  }, [debugTaps, navigate]);

  const dismissReminderCb = useCallback(
    async (id: number) => {
      await dismissReminder(id);
      await refresh(true);
    },
    [refresh],
  );

  const dismissNoteCb = useCallback(
    async (id: number) => {
      await dismissNote(id);
      await refresh(true);
    },
    [refresh],
  );

  async function runAction(id: string, force = false) {
    setPendingAction(id);
    try {
      await postDashboardAction(id, force ? { force: true } : {});
      await refresh(true);
    } finally {
      setPendingAction(null);
    }
  }

  function handleAction(id: string) {
    if (id === "restart-gateway") {
      setShowRestart(true);
      return;
    }
    void runAction(id);
  }

  async function confirmRestart() {
    setShowRestart(false);
    await runAction("restart-gateway");
  }

  const needsCity =
    !state?.widgets.weather.data && !state?.widgets.weather.stale;

  return (
    <div className="app-kiosk">
      <header className="home-header home-header--slim">
        <ClockHero onTap={() => setDebugTaps((n) => n + 1)} />
        <div className="home-header__tools">
          <Link to="/settings" className="settings-btn" aria-label="Settings">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5" />
            </svg>
          </Link>
          <div className={`api-pill ${state?.api.ok ? "api-pill--ok" : ""}`}>
            <span className="api-pill__dot" />
            {state?.api.ok ? "API OK" : "API down"}
          </div>
        </div>
      </header>

      <main className="home-zones">
        <SystemStateCard
          health={state?.openclaw ?? null}
          mock={state?.api.mock}
          error={error}
        />
        <AttentionCard
          alerts={state?.alerts ?? []}
          actions={state?.actions ?? []}
        />
        <ActionStrip
          actions={state?.actions ?? []}
          onAction={handleAction}
        />
        {state && (
          <UtilityRow
            state={state}
            needsCity={needsCity}
            weatherLoading={pendingAction === "refresh-probes"}
            onDismissReminder={(id) => void dismissReminderCb(id)}
            onDismissNote={(id) => void dismissNoteCb(id)}
          />
        )}
      </main>

      {toast && <div className="debug-toast">{toast}</div>}

      {showRestart && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Restart gateway?</h2>
            <p>Safe restart on your Pi. Active work may delay briefly.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="action-card action-card--secondary"
                onClick={() => setShowRestart(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="action-card action-card--primary"
                disabled={pendingAction === "restart-gateway"}
                onClick={() => void confirmRestart()}
              >
                {pendingAction === "restart-gateway" ? "Restarting…" : "Restart"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
