import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postDashboardAction } from "../api";
import TopStatusRow from "../components/TopStatusRow";
import RemindersPanel from "../components/RemindersPanel";
import HeroCard from "../components/HeroCard";
import GatewayDetailsCard from "../components/GatewayDetailsCard";
import QuickActionsRow from "../components/QuickActionsRow";
import { useDashboardCommands } from "../hooks/useDashboardCommands";
import { useDashboardState } from "../hooks/useDashboardState";

export default function Home() {
  const navigate = useNavigate();
  const { state, refresh } = useDashboardState();
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
      <TopStatusRow
        state={state}
        needsCity={needsCity}
        weatherLoading={pendingAction === "refresh-probes"}
        onClockTap={() => setDebugTaps((n) => n + 1)}
        onRefreshGateway={() => void runAction("refresh-probes")}
      />

      <section className="home-middle-row">
        <RemindersPanel reminders={state?.widgets.reminders ?? []} />
        <HeroCard hero={state?.widgets.hero} />
        <GatewayDetailsCard state={state} />
      </section>

      <QuickActionsRow
        actions={state?.actions ?? []}
        onAction={handleAction}
        pendingAction={pendingAction}
      />

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
