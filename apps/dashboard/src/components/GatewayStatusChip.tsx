import { Bot, Wifi } from "lucide-react";
import { Link } from "react-router-dom";
import type { SystemHealth } from "@concierge/shared";
import { formatLastSeen, friendlyHealthLabel } from "../utils/format";

interface Props {
  health: SystemHealth | null;
  mock?: boolean;
  onRefresh?: () => void;
  variant?: "chip" | "icon";
}

export default function GatewayStatusChip({
  health,
  mock,
  onRefresh,
  variant = "chip",
}: Props) {
  const state = health?.state ?? "unknown";
  const label = friendlyHealthLabel(state);
  const lastSeen = health?.lastCheckedAt
    ? formatLastSeen(health.lastCheckedAt)
    : "—";

  if (variant === "icon") {
    return (
      <div className="gateway-icon-wrap">
        {mock && <span className="gateway-icon-wrap__mock">M</span>}
        <Link
          to="/openclaw"
          className={`gateway-icon-btn gateway-icon-btn--${state}`}
          aria-label={`OpenClaw gateway: ${label}. Last seen ${lastSeen}`}
          title={`Gateway: ${label}`}
        >
          <Bot size={20} strokeWidth={2} />
          <span
            className={`gateway-icon-btn__dot gateway-icon-btn__dot--${state}`}
            aria-hidden
          />
        </Link>
      </div>
    );
  }

  return (
    <div className="dash-card gateway-chip">
      {mock && <span className="mock-banner">MOCK</span>}
      <div className="gateway-chip__info">
        <div className="gateway-chip__title">OpenClaw Gateway</div>
        <div className={`gateway-chip__status gateway-chip__status--${state}`}>
          <span className={`gateway-chip__dot gateway-chip__dot--${state}`} />
          {label}
        </div>
        <div className="gateway-chip__meta">Last seen: {lastSeen}</div>
      </div>
      <button
        type="button"
        className="gateway-chip__wifi"
        aria-label="Refresh gateway status"
        onClick={onRefresh}
        disabled={!onRefresh}
      >
        <Wifi size={24} strokeWidth={2.5} />
      </button>
    </div>
  );
}
