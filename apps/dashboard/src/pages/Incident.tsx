import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ackAlert, fetchAlerts, postDashboardAction } from "../api";
import type { Alert } from "@concierge/shared";
import ActionCard from "../components/ActionCard";

export default function Incident() {
  const { alertId } = useParams();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<Alert | null>(null);

  useEffect(() => {
    void fetchAlerts().then((list) => {
      setAlert(list.find((a) => a.id === alertId) ?? null);
    });
  }, [alertId]);

  async function handleAck() {
    if (!alert) return;
    await ackAlert(alert.id);
    navigate("/");
  }

  return (
    <div className="page-shell">
      <button type="button" className="back-btn" onClick={() => navigate("/")}>
        ← Back
      </button>
      <h1 className="page-title">{alert?.title ?? "Incident"}</h1>
      <p className="page-subtitle">{alert?.message ?? "Not found"}</p>
      {alert?.actions && (
        <div className="action-strip action-strip--page">
          {alert.actions.map((id) => (
            <ActionCard
              key={id}
              action={{
                id,
                label: id,
                permission: "auto",
                enabled: true,
                state: "idle",
              }}
              onClick={() => void postDashboardAction(id)}
            />
          ))}
        </div>
      )}
      {alert && alert.status === "active" && (
        <button
          type="button"
          className="action-card action-card--secondary"
          onClick={() => void handleAck()}
        >
          Acknowledge
        </button>
      )}
    </div>
  );
}
