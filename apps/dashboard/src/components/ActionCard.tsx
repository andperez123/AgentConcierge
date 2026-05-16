import type { DashboardAction } from "@concierge/shared";

interface Props {
  action: DashboardAction;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

export default function ActionCard({
  action,
  onClick,
  variant = "secondary",
}: Props) {
  const busy = action.state === "running" || action.state === "queued";
  const stateClass =
    action.state === "succeeded"
      ? "action-card--success"
      : action.state === "failed"
        ? "action-card--error"
        : busy
          ? "action-card--running"
          : "";

  return (
    <button
      type="button"
      className={`action-card action-card--${variant} ${stateClass}`}
      onClick={onClick}
      disabled={!action.enabled || busy}
    >
      <span className="action-card__label">
        {busy ? "…" : action.label}
      </span>
      {action.lastResult && action.state === "failed" && (
        <span className="action-card__hint">{action.lastResult.slice(0, 40)}</span>
      )}
    </button>
  );
}
