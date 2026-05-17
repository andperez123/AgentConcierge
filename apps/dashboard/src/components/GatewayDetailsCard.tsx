import { Link } from "react-router-dom";
import {
  Activity,
  Clock,
  Package,
  Shield,
  ChevronRight,
  Eye,
} from "lucide-react";
import type { DashboardState } from "@concierge/shared";
import {
  authLabel,
  formatLastSeen,
  formatUptime,
  friendlyHealthLabel,
} from "../utils/format";

interface Props {
  state: DashboardState | null;
}

export default function GatewayDetailsCard({ state }: Props) {
  const health = state?.openclaw ?? null;
  const stateKey = health?.state ?? "unknown";
  const statusLabel = friendlyHealthLabel(stateKey);
  const uptime = state?.device?.uptimeSeconds
    ? formatUptime(state.device.uptimeSeconds)
    : "—";
  const version = state?.api.version ?? "—";
  const auth = authLabel(health);
  const lastSeen = health?.lastCheckedAt
    ? formatLastSeen(health.lastCheckedAt)
    : "—";

  const authTone =
    auth === "Authenticated"
      ? "healthy"
      : auth === "Check auth"
        ? "action_needed"
        : undefined;

  const rows = [
    { icon: Activity, label: "Status", value: statusLabel, tone: stateKey },
    { icon: Clock, label: "Uptime", value: uptime },
    { icon: Package, label: "Version", value: version },
    { icon: Shield, label: "Auth", value: auth, tone: authTone },
    { icon: Eye, label: "Last seen", value: lastSeen },
  ];

  return (
    <article className="dash-card gateway-details">
      {state?.api.mock && <span className="mock-banner">MOCK</span>}
      <Link to="/openclaw" className="gateway-details__header-link">
        <span className="dash-card__header" style={{ marginBottom: 0 }}>
          OpenClaw Gateway
        </span>
        <ChevronRight size={18} />
      </Link>
      <ul className="stat-rows">
        {rows.map((row) => (
          <li key={row.label} className="stat-row">
            <span className="stat-row__icon">
              <row.icon size={16} />
            </span>
            <span className="stat-row__label">{row.label}</span>
            <span
              className={`stat-row__value${row.tone ? ` stat-row__value--${row.tone}` : ""}`}
            >
              {row.value}
            </span>
          </li>
        ))}
      </ul>
      <div className="dash-card__footer">
        <Link to="/openclaw" className="dash-card__footer-btn">
          View details
          <ChevronRight size={16} />
        </Link>
      </div>
    </article>
  );
}
