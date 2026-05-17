import { useNavigate } from "react-router-dom";
import {
  RotateCcw,
  Mic,
  FileText,
  Pencil,
  Lock,
  Zap,
} from "lucide-react";
import type { DashboardAction } from "@concierge/shared";

interface Props {
  actions: DashboardAction[];
  onAction: (id: string) => void;
  pendingAction: string | null;
}

const QUICK_ACTIONS = [
  { id: "restart-gateway", label: "Restart Gateway", icon: RotateCcw },
  { id: "voice", label: "Voice Command", icon: Mic, route: "/task/voice" },
  { id: "view-logs", label: "View Logs", icon: FileText, route: "/logs" },
  { id: "work", label: "Work", icon: Pencil, route: "/work" },
  { id: "reauth", label: "Reauthenticate", icon: Lock, route: "/task/reauth" },
] as const;

export default function QuickActionsRow({
  actions,
  onAction,
  pendingAction,
}: Props) {
  const navigate = useNavigate();
  const byId = Object.fromEntries(actions.map((a) => [a.id, a]));

  function handle(item: (typeof QUICK_ACTIONS)[number]) {
    if ("route" in item && item.route) {
      navigate(item.route);
      return;
    }
    onAction(item.id);
  }

  return (
    <section className="home-quick-actions">
      <header className="quick-actions__title">
        <Zap size={18} />
        <span>Quick Actions</span>
      </header>
      <div className="quick-actions__row">
        {QUICK_ACTIONS.map((item) => {
          const action = byId[item.id];
          const busy =
            action?.state === "running" || action?.state === "queued";
          const disabled =
            item.id !== "voice" &&
            item.id !== "work" &&
            action &&
            (!action.enabled || busy);
          return (
            <button
              key={item.id}
              type="button"
              className="quick-action"
              disabled={disabled || pendingAction === item.id}
              onClick={() => handle(item)}
            >
              <item.icon size={22} strokeWidth={2} />
              <span>
                {pendingAction === item.id
                  ? "…"
                  : busy && item.id === "restart-gateway"
                    ? "Working…"
                    : item.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
