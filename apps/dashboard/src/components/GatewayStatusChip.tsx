import { Wifi } from "lucide-react";
import type { SystemHealth } from "@concierge/shared";
import { formatLastSeen, friendlyHealthLabel } from "../utils/format";

interface Props {
  health: SystemHealth | null;
  mock?: boolean;
  onRefresh: () => void;
}

export default function GatewayStatusChip({ health, mock, onRefresh }: Props) {
  const state = health?.state ?? "unknown";
  const label = friendlyHealthLabel(state);
  const lastSeen = health?.lastCheckedAt
    ? formatLastSeen(health.lastCheckedAt)
    : "—";

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
      >
        <Wifi size={20} strokeWidth={2.5} />
      </button>
    </div>
  );
}
