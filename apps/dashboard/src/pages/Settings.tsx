import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GeocodeResult, TempUnit } from "@concierge/shared";
import { fetchSettings, saveSettings, searchGeocode } from "../api";
import ActionTile from "../components/ActionTile";

export default function Settings() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tempUnit, setTempUnit] = useState<TempUnit>("fahrenheit");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchSettings().then((s) => {
      if (s.city) setQuery(s.city);
      if (s.tempUnit) setTempUnit(s.tempUnit);
      if (s.city && s.latitude != null && s.longitude != null) {
        setSelected({
          name: s.city,
          latitude: s.latitude,
          longitude: s.longitude,
        });
      }
    });
  }, []);

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    setResults([]);
    setSelected(null);
    try {
      const hits = await searchGeocode(q);
      setResults(hits);
      if (hits.length === 0) {
        setError("No locations found — try a different name or ZIP");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = selected
        ? await saveSettings({
            city: selected.name,
            latitude: selected.latitude,
            longitude: selected.longitude,
            tempUnit,
          })
        : await saveSettings({ query: query.trim(), tempUnit });

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

  async function saveUnitsOnly(unit: TempUnit) {
    setTempUnit(unit);
    setSaving(true);
    setError(null);
    try {
      const res = await saveSettings({ tempUnit: unit });
      if (res.ok) setMessage("Units updated");
      else setError(res.message ?? "Failed");
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
      <p className="page-subtitle">Weather location and units</p>

      <label className="field-label" htmlFor="city">
        City or ZIP
      </label>
      <input
        id="city"
        className="field-input"
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
        }}
        placeholder="e.g. Chicago or 60601"
        autoComplete="off"
      />

      <ActionTile
        label={searching ? "Searching…" : "Find location"}
        variant="secondary"
        disabled={searching || !query.trim()}
        onClick={() => void handleSearch()}
      />

      {results.length > 0 && (
        <>
          <p className="field-label">Pick your location</p>
          <ul className="geocode-list">
            {results.map((r) => (
              <li key={`${r.latitude}-${r.longitude}`}>
                <button
                  type="button"
                  className={`geocode-item ${selected?.latitude === r.latitude && selected?.longitude === r.longitude ? "geocode-item--selected" : ""}`}
                  onClick={() => setSelected(r)}
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="field-label">Temperature</p>
      <div className="unit-toggle">
        <button
          type="button"
          className={`unit-toggle__btn ${tempUnit === "fahrenheit" ? "unit-toggle__btn--active" : ""}`}
          onClick={() => void saveUnitsOnly("fahrenheit")}
        >
          °F
        </button>
        <button
          type="button"
          className={`unit-toggle__btn ${tempUnit === "celsius" ? "unit-toggle__btn--active" : ""}`}
          onClick={() => void saveUnitsOnly("celsius")}
        >
          °C
        </button>
      </div>

      {error && <p className="field-error">{error}</p>}
      {message && <p className="field-success">{message}</p>}

      <ActionTile
        label={saving ? "Saving…" : "Save location"}
        variant="primary"
        disabled={saving || (!selected && !query.trim())}
        onClick={() => void handleSave()}
      />
    </div>
  );
}
