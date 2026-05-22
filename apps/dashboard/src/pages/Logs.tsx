import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchDiagnosticBundle,
  fetchIncidents,
  fetchLogs,
  fetchRestarts,
} from "../api";
import type { Incident, RestartEvent } from "@concierge/shared";
import ActionTile from "../components/ActionTile";

export default function Logs() {
  const navigate = useNavigate();
  const [lines, setLines] = useState<string[]>([]);
  const [path, setPath] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [restarts, setRestarts] = useState<RestartEvent[]>([]);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, inc, rest] = await Promise.all([
        fetchLogs(200),
        fetchIncidents({ limit: 5 }),
        fetchRestarts(),
      ]);
      setLines(data.lines);
      setPath(data.path);
      setIncidents(inc);
      setRestarts(rest.slice(0, 5));
    } catch {
      setLines(["Failed to load logs."]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const displayed = failuresOnly
    ? lines.filter((l) => /\b(error|fatal|panic|failed)\b/i.test(l))
    : lines;

  async function copyDiagnostic() {
    try {
      const bundle = await fetchDiagnosticBundle();
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="page-shell page-shell--logs">
      <header className="page-shell__header">
        <button type="button" className="back-btn" onClick={() => navigate("/")}>
          ← Back
        </button>
        <h1 className="page-title">Gateway logs</h1>
        {path && <p className="page-subtitle">{path}</p>}

        <div className="logs-toolbar">
          <ActionTile
            label={loading ? "Loading…" : "Refresh"}
            variant="secondary"
            onClick={() => void load()}
          />
          <button
            type="button"
            className={`chip${failuresOnly ? " chip--active" : ""}`}
            onClick={() => setFailuresOnly((v) => !v)}
          >
            Failures only
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => void copyDiagnostic()}
          >
            {copied ? "Copied" : "Copy diagnostic"}
          </button>
        </div>
      </header>

      <div className="page-shell__body">
        <div className="logs-layout">
          <aside className="logs-sidebar">
            <h2 className="logs-sidebar__title">Recent incidents</h2>
            {incidents.length === 0 ? (
              <p className="logs-sidebar__empty">None</p>
            ) : (
              <ul className="incident-list">
                {incidents.map((i) => (
                  <li key={i.id} className={`incident-item incident-item--${i.severity}`}>
                    <span className="incident-item__msg">{i.message.slice(0, 80)}</span>
                    <span className="incident-item__time">
                      {new Date(i.createdAt).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <h2 className="logs-sidebar__title">Restarts</h2>
            <ul className="incident-list">
              {restarts.map((r) => (
                <li key={r.id} className="incident-item">
                  <span className="incident-item__msg">
                    {r.trigger} · exit {r.exitCode ?? "?"}
                  </span>
                  <span className="incident-item__time">
                    {new Date(r.at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
          <pre className="logs-box">{displayed.join("\n")}</pre>
        </div>
      </div>
    </div>
  );
}
