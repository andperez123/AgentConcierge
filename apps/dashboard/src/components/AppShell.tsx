import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import { useDashboardState } from "../hooks/useDashboardState";

export default function AppShell() {
  const { state } = useDashboardState();

  return (
    <div className="app-shell">
      <main className="app-shell__main">
        <Outlet />
      </main>
      <BottomNav state={state} />
    </div>
  );
}
