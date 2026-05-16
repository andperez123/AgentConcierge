import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { postDashboardAction } from "../api";

export default function TaskReauth() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    try {
      const op = await postDashboardAction("reauth");
      setMsg(`Reauth started (${op.operationId.slice(0, 8)}…)`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell">
      <button type="button" className="back-btn" onClick={() => navigate("/")}>
        ← Back
      </button>
      <h1 className="page-title">Reauthenticate</h1>
      <ol className="task-steps">
        <li>Tap Start reauth below</li>
        <li>Confirm in terminal if OpenClaw prompts</li>
        <li>Return to home when gateway shows healthy</li>
      </ol>
      <button
        type="button"
        className="action-card action-card--primary"
        disabled={busy}
        onClick={() => void start()}
      >
        {busy ? "Running…" : "Start reauth"}
      </button>
      {msg && <p className="field-success">{msg}</p>}
    </div>
  );
}
