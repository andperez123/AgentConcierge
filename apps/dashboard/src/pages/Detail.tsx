import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { postDashboardAction } from "../api";
import ActionCard from "../components/ActionCard";
import { useDashboardState } from "../hooks/useDashboardState";

export default function Detail() {
  const navigate = useNavigate();
  const { state, refresh } = useDashboardState(true, 3000);
  const [message, setMessage] = useState<string | null>(null);
  const health = state?.openclaw;
  const legacy = health?.legacyState;

  async function run(id: string, body?: Record<string, unknown>) {
    setMessage(null);
    try {
      const op = await postDashboardAction(id, body);
      setMessage(`Started ${id} (${op.state})`);
      await refresh(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <div className="page-shell">
      <header className="page-shell__header">
        <button type="button" className="back-btn" onClick={() => navigate("/")}>
          ← Back
        </button>
        <h1 className="page-title">OpenClaw detail</h1>
      </header>

      <div className="page-shell__body">
        <div className="detail-grid">
          <div className="detail-row">
            <label>Health</label>
            <div className="value">{health?.state ?? "—"}</div>
          </div>
          <div className="detail-row">
            <label>Summary</label>
            <div className="value">{health?.summary ?? "—"}</div>
          </div>
          <div className="detail-row">
            <label>Legacy state</label>
            <div className="value">{legacy ?? "—"}</div>
          </div>
          <div className="detail-row">
            <label>Last check</label>
            <div className="value">
              {health?.lastCheckedAt
                ? new Date(health.lastCheckedAt).toLocaleString()
                : "—"}
            </div>
          </div>
          {health?.reasons && health.reasons.length > 0 && (
            <div className="detail-row">
              <label>Reasons</label>
              <div className="value">{health.reasons.join(" · ")}</div>
            </div>
          )}
          {state?.api.mock && (
            <div className="detail-row">
              <label>Mode</label>
              <div className="value">Mock (dev)</div>
            </div>
          )}
        </div>

        {message && (
          <div className="detail-row">
            <label>Result</label>
            <div className="value value--compact">{message}</div>
          </div>
        )}

        <div className="action-strip action-strip--page">
          {(state?.actions ?? [])
            .filter((a) =>
              ["restart-gateway", "run-doctor", "reauth", "refresh-probes", "view-logs"].includes(
                a.id,
              ),
            )
            .map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                variant={action.id === "restart-gateway" ? "primary" : "secondary"}
                onClick={() => {
                  if (action.id === "view-logs") navigate("/logs");
                  else if (action.id === "restart-gateway")
                    void run("restart-gateway");
                  else void run(action.id);
                }}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
