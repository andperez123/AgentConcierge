import { Link } from "react-router-dom";
import type { SystemHealth } from "@concierge/shared";

interface Props {
  health: SystemHealth | null;
  mock?: boolean;
  error?: string | null;
}

const STATE_LABEL: Record<string, string> = {
  healthy: "HEALTHY",
  degraded: "DEGRADED",
  blocked: "BLOCKED",
  action_needed: "ACTION NEEDED",
  restarting: "RESTARTING",
  unknown: "UNKNOWN",
};

export default function SystemStateCard({ health, mock, error }: Props) {
  const state = health?.state ?? "unknown";
  const label = STATE_LABEL[state] ?? state.toUpperCase();
  const summary = error ?? health?.summary ?? "Checking…";
  const checkedSec = health?.lastCheckedAt
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(health.lastCheckedAt).getTime()) / 1000,
        ),
      )
    : null;

  return (
    <Link
      to="/openclaw"
      className={`system-card system-card--${state}${health?.stale ? " system-card--stale" : ""}`}
    >
      {mock && <span className="mock-banner">MOCK</span>}
      {health?.stale && <span className="stale-badge">Stale</span>}
      <div className="system-card__left">
        <span className="system-card__label">OpenClaw</span>
        <span className="system-card__title">Gateway</span>
        <span className="system-card__summary">{summary}</span>
      </div>
      <div className="system-card__right">
        <span className={`system-card__badge system-card__badge--${state}`}>
          {label}
        </span>
        {checkedSec !== null && (
          <span className="system-card__meta">Checked {checkedSec}s ago</span>
        )}
      </div>
    </Link>
  );
}
