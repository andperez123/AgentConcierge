import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSettings, saveSettings } from "../api";
import ActionTile from "../components/ActionTile";

export default function Settings() {
  const navigate = useNavigate();
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchSettings().then((s) => {
      if (s.city) setCity(s.city);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await saveSettings(city);
      if (res.ok) {
        setMessage(res.message ?? "Saved");
        setTimeout(() => navigate("/"), 800);
      } else {
        setError(res.message ?? "Save failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell">
      <button
        type="button"
        className="back-btn"
        onClick={() => navigate("/")}
      >
        ← Back
      </button>

      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Weather location for your desk display</p>

      <label className="field-label" htmlFor="city">
        City
      </label>
      <input
        id="city"
        className="field-input"
        type="text"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="e.g. Chicago"
        autoComplete="off"
      />

      {error && <p className="field-error">{error}</p>}
      {message && <p className="field-success">{message}</p>}

      <ActionTile
        label={saving ? "Saving…" : "Save city"}
        variant="primary"
        disabled={saving || !city.trim()}
        onClick={() => void handleSave()}
      />
    </div>
  );
}
