import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardStateContext } from "../context/DashboardStateContext";

export function useDashboardCommands(
  onToast?: (msg: string, level?: string) => void,
) {
  const { subscribeCommands } = useDashboardStateContext();
  const navigate = useNavigate();

  useEffect(() => {
    return subscribeCommands((cmd) => {
      if (cmd.type === "toast" && cmd.message) {
        onToast?.(cmd.message, cmd.level);
      } else if (cmd.type === "navigate" && cmd.route) {
        navigate(cmd.route);
      } else if (cmd.type === "focus-alert" && cmd.alertId) {
        navigate(`/incident/${cmd.alertId}`);
      }
    });
  }, [navigate, onToast, subscribeCommands]);
}
