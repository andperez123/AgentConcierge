import { useNavigate } from "react-router-dom";
import type { Alert, DashboardAction } from "@concierge/shared";

interface Props {
  alerts: Alert[];
  actions: DashboardAction[];
}

export default function AttentionCard({ alerts, actions }: Props) {
  const navigate = useNavigate();
  const stuck = actions.filter(
    (a) => a.state === "running" || a.state === "queued",
  );

  const items = [
    ...alerts.slice(0, 3).map((a) => ({
      key: a.id,
      title: a.title,
      sub: a.message,
      level: a.level,
      onClick: () => navigate(`/incident/${a.id}`),
    })),
    ...stuck.map((a) => ({
      key: `op-${a.id}`,
      title: a.label,
      sub: a.state === "running" ? "Running…" : "Queued",
      level: "info" as const,
      onClick: undefined,
    })),
  ];

  return (
    <div className="attention-card">
      <div className="attention-card__title">Needs attention</div>
      {items.length === 0 ? (
        <p className="attention-card__empty">All clear</p>
      ) : (
        <ul className="attention-list">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className={`attention-item attention-item--${item.level}`}
                onClick={item.onClick}
                disabled={!item.onClick}
              >
                <span className="attention-item__title">{item.title}</span>
                <span className="attention-item__sub">{item.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
