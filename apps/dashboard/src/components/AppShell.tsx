import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import {
  DashboardStateProvider,
  useDashboardStateContext,
} from "../context/DashboardStateContext";

function AppShellInner() {
  const { state } = useDashboardStateContext();

  return (
    <div className="app-shell">
      <main className="app-shell__main">
        <Outlet />
      </main>
      <BottomNav state={state} />
    </div>
  );
}

export default function AppShell() {
  return (
    <DashboardStateProvider>
      <AppShellInner />
    </DashboardStateProvider>
  );
}
