import { useNavigate } from "react-router-dom";
import { useDashboardState } from "../hooks/useDashboardState";
import ActionCard from "../components/ActionCard";
import { postDashboardAction } from "../api";

export default function TaskRecovery() {
  const navigate = useNavigate();
  const { state } = useDashboardState(true, 3000);
  const health = state?.openclaw;
  const recommended = health?.recommendedActions ?? [];

  return (
    <div className="page-shell">
      <header className="page-shell__header">
        <button type="button" className="back-btn" onClick={() => navigate("/")}>
          ← Back
        </button>
        <h1 className="page-title">Recovery</h1>
        <p className="page-subtitle">{health?.summary ?? "Loading…"}</p>
      </header>

      <div className="page-shell__body">
        {health?.operatorSteps && (
          <ol className="task-steps">
            {health.operatorSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        )}
        <div className="action-strip action-strip--page">
          {recommended.map((id) => {
            const action = state?.actions.find((a) => a.id === id);
            return (
              <ActionCard
                key={id}
                action={
                  action ?? {
                    id,
                    label: id,
                    permission: "auto",
                    enabled: true,
                    state: "idle",
                  }
                }
                variant={id === "restart-gateway" ? "primary" : "secondary"}
                onClick={() => {
                  if (id === "view-logs") navigate("/logs");
                  else void postDashboardAction(id);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
