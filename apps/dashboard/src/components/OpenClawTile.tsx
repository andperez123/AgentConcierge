import { Link } from "react-router-dom";
import type { OpenClawStatus } from "@concierge/shared";

interface Props {
  status: OpenClawStatus | null;
  error: string | null;
  mock?: boolean;
}

function secondsAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
}

export default function OpenClawTile({ status, error, mock }: Props) {
  const state = status?.state ?? "offline";
  const checkedSec = status ? secondsAgo(status.checkedAt) : null;

  const label =
    state === "online"
      ? "ONLINE"
      : state === "degraded"
        ? "DEGRADED"
        : "OFFLINE";

  const meta = error
    ? error
    : checkedSec !== null
      ? `Last check ${checkedSec}s ago`
      : "Checking…";

  return (
    <Link
      to="/openclaw"
      className={`openclaw-tile openclaw-tile--${state}`}
    >
      {mock && <span className="mock-banner">MOCK</span>}
      <div className="openclaw-tile__left">
        <span className="openclaw-tile__label">OpenClaw</span>
        <span className="openclaw-tile__title">Gateway</span>
      </div>
      <div className="openclaw-tile__right">
        <span className={`openclaw-tile__badge openclaw-tile__badge--${state}`}>
          {label}
        </span>
        <span className="openclaw-tile__meta">{meta}</span>
      </div>
    </Link>
  );
}
