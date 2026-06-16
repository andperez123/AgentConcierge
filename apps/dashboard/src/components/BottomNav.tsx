import { Link, useLocation } from "react-router-dom";
import {
  Home,
  CalendarDays,
  ListChecks,
  Briefcase,
  Mic,
  Settings,
} from "lucide-react";
import type { DashboardState } from "@concierge/shared";
import { useAppPrefs } from "../context/AppPrefsContext";

interface Props {
  state: DashboardState | null;
}

export default function BottomNav({ state: _state }: Props) {
  const { pathname } = useLocation();
  const { mode } = useAppPrefs();
  const deskLabel = mode === "work" ? "Work" : "Life";
  const goalsLabel = mode === "work" ? "Goals" : "Reminders";

  function navClass(path: string): string {
    const active =
      path === "/"
        ? pathname === "/"
        : path === "/work"
          ? pathname === "/work" ||
            pathname.startsWith("/projects/") ||
            pathname === "/notes" ||
            pathname.startsWith("/notes/")
          : pathname === path || pathname.startsWith(`${path}/`);
    return `bottom-nav__item${active ? " bottom-nav__item--active" : ""}`;
  }

  return (
    <nav className="bottom-nav bottom-nav--6" aria-label="Main">
      <Link to="/" className={navClass("/")}>
        <Home strokeWidth={2} />
        <span>Home</span>
      </Link>
      <Link to="/calendar" className={navClass("/calendar")}>
        <CalendarDays strokeWidth={2} />
        <span>Calendar</span>
      </Link>
      <Link to="/reminders" className={navClass("/reminders")}>
        <ListChecks strokeWidth={2} />
        <span>{goalsLabel}</span>
      </Link>
      <Link to="/task/voice" className="bottom-nav__fab" aria-label="Voice">
        <Mic strokeWidth={2} size={28} />
      </Link>
      <Link to="/work" className={navClass("/work")}>
        <Briefcase strokeWidth={2} />
        <span>{deskLabel}</span>
      </Link>
      <Link to="/settings" className={navClass("/settings")}>
        <Settings strokeWidth={2} />
        <span>Settings</span>
      </Link>
    </nav>
  );
}
