import { useNavigate } from "react-router-dom";
import type { DashboardAction } from "@concierge/shared";
import ActionCard from "./ActionCard";

interface Props {
  actions: DashboardAction[];
  onAction: (id: string) => void;
}

const STRIP_IDS = [
  "restart-gateway",
  "run-doctor",
  "view-logs",
  "refresh-probes",
];

export default function ActionStrip({ actions, onAction }: Props) {
  const navigate = useNavigate();
  const byId = Object.fromEntries(actions.map((a) => [a.id, a]));

  function handle(id: string) {
    if (id === "view-logs") {
      navigate("/logs");
      return;
    }
    onAction(id);
  }

  return (
    <div className="action-strip">
      {STRIP_IDS.map((id, i) => {
        const action = byId[id] ?? {
          id,
          label: id,
          permission: "auto" as const,
          enabled: true,
          state: "idle" as const,
        };
        return (
          <ActionCard
            key={id}
            action={action}
            variant={i === 0 ? "primary" : "secondary"}
            onClick={() => handle(id)}
          />
        );
      })}
    </div>
  );
}
