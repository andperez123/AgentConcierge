import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchHealth, restartGateway, touchTest } from "../api";
import ActionTile from "../components/ActionTile";
import ClockHero from "../components/ClockHero";
import OpenClawTile from "../components/OpenClawTile";
import WeatherCard from "../components/WeatherCard";
import { useOpenClawStatus } from "../hooks/useOpenClawStatus";
import { useWeather } from "../hooks/useWeather";

export default function Home() {
  const { status, error, refresh } = useOpenClawStatus(5000);
  const {
    weather,
    needsCity,
    loading: weatherLoading,
    refresh: refreshWeather,
  } = useWeather();
  const navigate = useNavigate();
  const [apiOk, setApiOk] = useState(false);
  const [mock, setMock] = useState(false);
  const [showRestart, setShowRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [debugMsg, setDebugMsg] = useState<string | null>(null);

  useEffect(() => {
    void fetchHealth()
      .then((h) => {
        setApiOk(h.ok);
        setMock(h.mock);
      })
      .catch(() => setApiOk(false));
  }, []);

  async function confirmRestart() {
    setRestarting(true);
    try {
      await restartGateway();
      setShowRestart(false);
      await refresh(true);
      await refreshWeather(true);
    } finally {
      setRestarting(false);
    }
  }

  async function handleClockLongPress() {
    const res = await touchTest();
    setDebugMsg(`Touch OK · count ${res.count}`);
    setTimeout(() => setDebugMsg(null), 3000);
  }

  return (
    <div className="app-kiosk">
      <header className="home-header">
        <div className="home-top">
          <ClockHero onLongPress={() => void handleClockLongPress()} />
          <WeatherCard
            weather={weather}
            needsCity={needsCity}
            loading={weatherLoading}
          />
        </div>
        <div className="home-header__tools">
          <Link to="/settings" className="settings-btn" aria-label="Settings">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5" />
            </svg>
          </Link>
          <div className={`api-pill ${apiOk ? "api-pill--ok" : ""}`}>
            <span className="api-pill__dot" />
            {apiOk ? "API OK" : "API down"}
          </div>
        </div>
      </header>

      <OpenClawTile status={status} error={error} mock={mock} />

      <div className="actions-row">
        <ActionTile
          label="Restart gateway"
          variant="primary"
          onClick={() => setShowRestart(true)}
        />
        <ActionTile
          label="View logs"
          variant="secondary"
          onClick={() => navigate("/logs")}
        />
      </div>

      {debugMsg && <div className="debug-toast">{debugMsg}</div>}

      {showRestart && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Restart gateway?</h2>
            <p>Safe restart on your Pi. Active work may delay briefly.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="action-tile action-tile--secondary"
                onClick={() => setShowRestart(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="action-tile action-tile--primary"
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
