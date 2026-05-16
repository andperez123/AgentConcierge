import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchLogs } from "../api";
import ActionTile from "../components/ActionTile";

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
    <div className="page-shell">
      <button type="button" className="back-btn" onClick={() => navigate("/")}>
        ← Back
      </button>
      <h1 className="page-title">Gateway logs</h1>
      {path && <p className="page-subtitle">{path}</p>}
      <ActionTile
        label={loading ? "Loading…" : "Refresh"}
        variant="secondary"
        onClick={() => void load()}
      />
      <pre className="logs-box">{lines.join("\n")}</pre>
    </div>
  );
}
