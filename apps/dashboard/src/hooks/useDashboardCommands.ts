import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { DashboardCommand } from "@concierge/shared";

export function useDashboardCommands(
  onToast?: (msg: string, level?: string) => void,
) {
  const navigate = useNavigate();

  useEffect(() => {
    const es = new EventSource("/api/dashboard/events");
    es.addEventListener("command", (ev) => {
      try {
        const cmd = JSON.parse(ev.data) as DashboardCommand & {
          commandId?: string;
        };
        if (cmd.type === "toast" && cmd.message) {
          onToast?.(cmd.message, cmd.level);
        } else if (cmd.type === "navigate" && cmd.route) {
          navigate(cmd.route);
        } else if (cmd.type === "focus-alert" && cmd.alertId) {
          navigate(`/incident/${cmd.alertId}`);
        }
      } catch {
        /* ignore */
      }
    });
    return () => es.close();
  }, [navigate, onToast]);
}
