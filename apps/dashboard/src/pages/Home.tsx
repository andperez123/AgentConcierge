import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchDeviceStatus,
  fetchHealth,
  restartGateway,
  touchTest,
} from "../api";
import { useClock } from "../hooks/useClock";
import { useOpenClawStatus } from "../hooks/useOpenClawStatus";

function secondsAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
}

export default function Home() {
  const { time, date } = useClock();
  const { status, error, refresh } = useOpenClawStatus(5000);
  const navigate = useNavigate();
  const [apiOk, setApiOk] = useState(false);
  const [mock, setMock] = useState(false);
  const [touchCount, setTouchCount] = useState(0);
  const [screenLabel, setScreenLabel] = useState("");
  const [showRestart, setShowRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    void fetchHealth()
      .then((h) => {
        setApiOk(h.ok);
        setMock(h.mock);
      })
      .catch(() => setApiOk(false));
    void fetchDeviceStatus().then((d) => {
      if (d.screen) {
        setScreenLabel(`${d.screen.width}×${d.screen.height}`);
      }
    });
  }, []);

  const state = status?.state ?? "offline";
  const checkedSec = status ? secondsAgo(status.checkedAt) : null;

  async function handleTouchTest(e: React.MouseEvent<HTMLButtonElement>) {
    const card = e.currentTarget.closest(".status-card");
    if (card) {
      const cr = card.getBoundingClientRect();
      setRipple({
        x: ((e.clientX - cr.left) / cr.width) * 100,
        y: ((e.clientY - cr.top) / cr.height) * 100,
      });
      setTimeout(() => setRipple(null), 500);
    }
    const res = await touchTest();
    setTouchCount(res.count);
  }

  async function confirmRestart() {
    setRestarting(true);
    try {
      await restartGateway();
      setShowRestart(false);
      await refresh(true);
    } finally {
      setRestarting(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="clock">{time}</div>
          <div className="date">{date}</div>
        </div>
        <div className={`api-dot ${apiOk ? "ok" : ""}`}>
          <span className="bullet" />
          {apiOk ? "API OK" : "API down"}
        </div>
      </header>

      <Link
        to="/openclaw"
        className={`status-card ${state}`}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        {ripple && (
          <div
            className="touch-ripple"
            style={{ "--x": `${ripple.x}%`, "--y": `${ripple.y}%` } as React.CSSProperties}
          />
        )}
        {mock && <span className="mock-banner">MOCK</span>}
        <span className="status-label">OpenClaw</span>
        <div className={`status-badge ${state}`}>
          {state === "online"
            ? "ONLINE"
            : state === "degraded"
              ? "DEGRADED"
              : "OFFLINE"}
        </div>
        <div className="status-title">Gateway</div>
        <div className="status-meta">
          {status?.probe.reachable
            ? `Reachable · ${status.probe.capability ?? "connected"}`
            : "Not reachable on loopback"}
          <br />
          {error
            ? `Error: ${error}`
            : checkedSec !== null
              ? `Last check: ${checkedSec}s ago`
              : "Checking…"}
          {status?.lastRestartAt && (
            <>
              <br />
              Last restart: {new Date(status.lastRestartAt).toLocaleString()}
            </>
          )}
        </div>
      </Link>

      <div className="system-strip">
        <span>
          Display {screenLabel || `${screen.width}×${screen.height}`}
        </span>
        <span>Touch {touchCount > 0 ? `OK (${touchCount})` : "—"}</span>
        <span>Poll 5s</span>
        <button type="button" className="touch-btn" onClick={handleTouchTest}>
          Tap to test
        </button>
      </div>

      <div className="actions">
        <button
          type="button"
          className="primary"
          onClick={() => setShowRestart(true)}
        >
          Restart gateway
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => navigate("/logs")}
        >
          View logs
        </button>
      </div>

      {showRestart && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Restart gateway?</h2>
            <p>
              Runs a safe restart on your Pi. Active work may delay restart
              briefly.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setShowRestart(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={restarting}
                onClick={() => void confirmRestart()}
              >
                {restarting ? "Restarting…" : "Restart"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
