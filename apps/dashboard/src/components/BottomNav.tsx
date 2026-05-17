import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Bot,
  StickyNote,
  Mic,
  Settings,
} from "lucide-react";
import type { DashboardState } from "@concierge/shared";

interface Props {
  state: DashboardState | null;
}

function showOpenClawBadge(state: DashboardState | null): boolean {
  if (!state) return false;
  if (state.alerts.length > 0) return true;
  const s = state.openclaw.state;
  return s === "action_needed" || s === "blocked";
}

export default function BottomNav({ state }: Props) {
  const { pathname } = useLocation();
  const badge = showOpenClawBadge(state);

  function navClass(path: string): string {
    const active =
      path === "/"
        ? pathname === "/"
        : pathname === path || pathname.startsWith(`${path}/`);
    return `bottom-nav__item${active ? " bottom-nav__item--active" : ""}`;
  }

  return (
    <nav className="bottom-nav" aria-label="Main">
      <Link to="/" className={navClass("/")}>
        <Home strokeWidth={2} />
        <span>Home</span>
      </Link>
      <Link to="/openclaw" className={navClass("/openclaw")}>
        <Bot strokeWidth={2} />
        <span>OpenClaw</span>
        {badge && <span className="bottom-nav__badge" aria-hidden />}
      </Link>
      <Link to="/task/voice" className="bottom-nav__fab" aria-label="Voice">
        <Mic strokeWidth={2} size={28} />
      </Link>
      <Link to="/notes" className={navClass("/notes")}>
        <StickyNote strokeWidth={2} />
        <span>Notes</span>
      </Link>
      <Link to="/settings" className={navClass("/settings")}>
        <Settings strokeWidth={2} />
        <span>Settings</span>
      </Link>
    </nav>
  );
}
