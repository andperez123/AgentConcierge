import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { restartGateway, runDoctor } from "../api";
import ActionTile from "../components/ActionTile";
import { useOpenClawStatus } from "../hooks/useOpenClawStatus";

export default function Detail() {
  const navigate = useNavigate();
  const { status, refresh } = useOpenClawStatus(3000);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRestart(force = false) {
    setBusy("restart");
    setMessage(null);
    try {
      const res = await restartGateway(force);
      setMessage(res.message);
      await refresh(true);
    } finally {
      setBusy(null);
    }
  }

  async function handleDoctor() {
    setBusy("doctor");
    setMessage(null);
    try {
      const res = await runDoctor();
      setMessage(res.message.slice(0, 500));
    } finally {
      setBusy(null);
    }
  }

  const s = status;

  return (
    <div className="page-shell">
      <button type="button" className="back-btn" onClick={() => navigate("/")}>
        ← Back
      </button>

      <h1 className="page-title">OpenClaw detail</h1>

      <div className="detail-grid">
        <div className="detail-row">
          <label>State</label>
          <div className="value">{s?.state ?? "—"}</div>
        </div>
        <div className="detail-row">
          <label>Service</label>
          <div className="value">
            {s?.service.running ? "Running" : "Stopped"}
            {s?.service.unit ? ` · ${s.service.unit}` : ""}
          </div>
        </div>
        <div className="detail-row">
          <label>Probe</label>
          <div className="value">
            {s?.probe.reachable ? "Reachable" : "Unreachable"}
            {s?.probe.capability ? ` · ${s.probe.capability}` : ""}
            {s?.probe.readProbe ? ` · read: ${s.probe.readProbe}` : ""}
          </div>
        </div>
        <div className="detail-row">
          <label>Readyz</label>
          <div className="value">{s?.readyz ?? "—"}</div>
        </div>
        <div className="detail-row">
          <label>Last check</label>
          <div className="value">
            {s?.checkedAt ? new Date(s.checkedAt).toLocaleString() : "—"}
          </div>
        </div>
        <div className="detail-row">
          <label>Last restart</label>
          <div className="value">
            {s?.lastRestartAt
              ? new Date(s.lastRestartAt).toLocaleString()
              : "—"}
          </div>
        </div>
        {s?.mock && (
          <div className="detail-row">
            <label>Mode</label>
            <div className="value">Mock (dev)</div>
          </div>
        )}
      </div>

      {message && (
        <div className="detail-row" style={{ marginBottom: 12 }}>
          <label>Result</label>
          <div className="value" style={{ fontSize: "0.85rem" }}>
            {message}
          </div>
        </div>
      )}

      <div className="actions-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <ActionTile
          label={busy === "restart" ? "…" : "Safe restart"}
          variant="primary"
          disabled={busy !== null}
          onClick={() => void handleRestart()}
        />
        <ActionTile
          label="Force restart"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => void handleRestart(true)}
        />
        <ActionTile
          label={busy === "doctor" ? "…" : "Doctor"}
          variant="secondary"
          disabled={busy !== null}
          onClick={() => void handleDoctor()}
        />
      </div>

      <ActionTile
        label="View logs"
        variant="secondary"
        onClick={() => navigate("/logs")}
      />
    </div>
  );
}
