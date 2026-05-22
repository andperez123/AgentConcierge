import { Link } from "react-router-dom";
import { Shield, ChevronRight, RefreshCw, ExternalLink } from "lucide-react";
import type { GoogleAuthStatus } from "@concierge/shared";

const DRIVE_URL = "https://drive.google.com";

interface Props {
  status: GoogleAuthStatus | null | undefined;
  onRefresh?: () => void;
  onReauth?: () => void;
  reauthBusy?: boolean;
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
  onReauth,
  reauthBusy,
  loading,
}: Props) {
  const state = status?.state ?? "unknown";
  const valueLabel = label(state);
  const authTone = tone(state);
  const needsReauth =
    state === "expired" || state === "missing" || state === "unknown";
  const connected = state === "connected";

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
            disabled={loading || reauthBusy}
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
      <footer className="dash-card__footer google-auth-card__actions">
        {connected && (
          <a
            href={DRIVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="dash-card__footer-btn"
          >
            Open Google Drive
            <ExternalLink size={16} />
          </a>
        )}
        {needsReauth && onReauth ? (
          <button
            type="button"
            className="dash-card__footer-btn"
            disabled={reauthBusy}
            onClick={onReauth}
          >
            {reauthBusy ? "Reauthenticating…" : "Reauthenticate Google"}
            <ChevronRight size={16} />
          </button>
        ) : needsReauth ? (
          <Link to="/task/reauth" className="dash-card__footer-btn">
            Fix authentication
            <ChevronRight size={16} />
          </Link>
        ) : null}
      </footer>
    </article>
  );
}
