import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchLogs } from "../api";

export default function Logs() {
  const navigate = useNavigate();
  const [lines, setLines] = useState<string[]>([]);
  const [path, setPath] = useState<string>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLogs(200);
      setLines(data.lines);
      setPath(data.path);
    } catch {
      setLines(["Failed to load logs."]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="logs-page">
      <button type="button" className="back-btn" onClick={() => navigate("/")}>
        ← Back
      </button>
      <h1>Gateway logs</h1>
      {path && (
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{path}</p>
      )}
      <button
        type="button"
        className="secondary"
        style={{ marginBottom: 12, alignSelf: "flex-start" }}
        onClick={() => void load()}
      >
        {loading ? "Loading…" : "Refresh"}
      </button>
      <pre className="logs-box">{lines.join("\n")}</pre>
    </div>
  );
}
