import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchDeviceStatus,
  fetchDiagnosticBundle,
  fetchHealth,
  touchTest,
} from "../api";
import type { DeviceStatus, DiagnosticBundle } from "@concierge/shared";

export default function Debug() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<Awaited<ReturnType<typeof fetchHealth>> | null>(null);
  const [device, setDevice] = useState<DeviceStatus | null>(null);
  const [diag, setDiag] = useState<DiagnosticBundle | null>(null);
  const [touchMsg, setTouchMsg] = useState<string | null>(null);

  useEffect(() => {
    void fetchHealth().then(setHealth);
    void fetchDeviceStatus().then(setDevice);
    void fetchDiagnosticBundle().then(setDiag).catch(() => null);
  }, []);

  async function handleTouch() {
    const res = await touchTest();
    setTouchMsg(`Touch OK · count ${res.count}`);
    setTimeout(() => setTouchMsg(null), 3000);
  }

  return (
    <div className="page-shell page-shell--debug">
      <header className="page-shell__header">
        <button type="button" className="back-btn" onClick={() => navigate("/")}>
          ← Back
        </button>
        <h1 className="page-title">Debug</h1>
      </header>

      <div className="page-shell__body">
        <section className="detail-grid">
          <div className="detail-row">
            <label>API</label>
            <div className="value">
              {health ? `v${health.version} · mock=${String(health.mock)}` : "—"}
            </div>
          </div>
          <div className="detail-row">
            <label>Screen</label>
            <div className="value">
              {device?.screen
                ? `${device.screen.width}×${device.screen.height}`
                : "—"}
              {device?.kiosk ? " · kiosk" : ""}
            </div>
          </div>
          <div className="detail-row">
            <label>Host</label>
            <div className="value">
              {device?.hostname} · {device?.platform} / {device?.arch}
            </div>
          </div>
          <div className="detail-row">
            <label>Uptime</label>
            <div className="value">
              {device
                ? `${Math.floor(device.uptimeSeconds / 3600)}h ${Math.floor((device.uptimeSeconds % 3600) / 60)}m`
                : "—"}
            </div>
          </div>
          <div className="detail-row">
            <label>Network</label>
            <div className="value">
              {device?.networkOnline === undefined
                ? "—"
                : device.networkOnline
                  ? "Online"
                  : "Offline"}
            </div>
          </div>
        </section>

        {device?.metrics && (
          <section className="detail-grid">
            {device.metrics.map((m) => (
              <div key={m.label} className="detail-row">
                <label>{m.label}</label>
                <div className={`value value--${m.level}`}>{m.value}</div>
              </div>
            ))}
          </section>
        )}

        <button
          type="button"
          className="action-card action-card--secondary"
          onClick={() => void handleTouch()}
        >
          Touch test
        </button>

        {touchMsg && <p className="field-success">{touchMsg}</p>}

        {diag && (
          <details className="debug-details">
            <summary>Diagnostic bundle</summary>
            <pre className="logs-box logs-box--small">
              {JSON.stringify(diag, null, 2).slice(0, 4000)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
