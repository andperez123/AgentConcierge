import { Link } from "react-router-dom";
import { Shield, ChevronRight, RefreshCw } from "lucide-react";
import type { GoogleAuthStatus } from "@concierge/shared";

interface Props {
  status: GoogleAuthStatus | null | undefined;
  onRefresh?: () => void;
  loading?: boolean;
}

function label(state: GoogleAuthStatus["state"]): string {
  switch (state) {
    case "connected":
      return "Connected";
    case "expired":
      return "Expired";
    case "missing":
      return "Not connected";
    default:
      return "Unknown";
  }
}

function tone(state: GoogleAuthStatus["state"]): string | undefined {
  switch (state) {
    case "connected":
      return "healthy";
    case "expired":
    case "missing":
      return "action_needed";
    default:
      return undefined;
  }
}

export default function GoogleAuthCard({
  status,
  onRefresh,
  loading,
}: Props) {
  const state = status?.state ?? "unknown";
  const valueLabel = label(state);
  const authTone = tone(state);

  return (
    <article className="dash-card google-auth-card">
      <header className="dash-card__header">
        <Shield size={18} />
        <span>Google</span>
        {onRefresh && (
          <button
            type="button"
            className="google-auth-card__refresh"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh Google status"
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
        )}
      </header>
      <ul className="stat-rows">
        <li className="stat-row">
          <span className="stat-row__label">Account</span>
          <span
            className={`stat-row__value${authTone ? ` stat-row__value--${authTone}` : ""}`}
          >
            {status?.account ?? valueLabel}
          </span>
        </li>
        {status?.message && (
          <li className="stat-row">
            <span className="stat-row__label">Status</span>
            <span className="stat-row__value">{status.message}</span>
          </li>
        )}
      </ul>
      {(state === "expired" || state === "missing") && (
        <footer className="dash-card__footer">
          <Link to="/task/reauth" className="dash-card__footer-btn">
            Fix authentication
            <ChevronRight size={16} />
          </Link>
        </footer>
      )}
    </article>
  );
}
