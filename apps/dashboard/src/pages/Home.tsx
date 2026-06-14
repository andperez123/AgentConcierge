import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopStatusRow from "../components/TopStatusRow";
import RemindersPanel from "../components/RemindersPanel";
import NotesPanel from "../components/NotesPanel";
import ProjectsCard from "../components/ProjectsCard";
import { useAppPrefs } from "../context/AppPrefsContext";
import { useDashboardCommands } from "../hooks/useDashboardCommands";
import { useDashboardState } from "../hooks/useDashboardState";

export default function Home() {
  const navigate = useNavigate();
  const { mode } = useAppPrefs();
  const { state } = useDashboardState();
  const [toast, setToast] = useState<string | null>(null);
  const [debugTaps, setDebugTaps] = useState(0);

  useDashboardCommands((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  });

  useEffect(() => {
    if (debugTaps >= 5) navigate("/debug");
    if (debugTaps > 0) {
      const t = setTimeout(() => setDebugTaps(0), 2000);
      return () => clearTimeout(t);
    }
  }, [debugTaps, navigate]);

  const needsCity =
    !state?.widgets.weather.data && !state?.widgets.weather.stale;

  const isWork = mode === "work";

  return (
    <div className="app-kiosk">
      <TopStatusRow
        state={state}
        needsCity={needsCity}
        onClockTap={() => setDebugTaps((n) => n + 1)}
      />

      <section className="home-middle-row">
        <RemindersPanel
          reminders={state?.widgets.reminders ?? []}
          mode={mode}
        />
        <NotesPanel notes={state?.widgets.notes ?? []} mode={mode} />
        {isWork && (
          <ProjectsCard projects={state?.widgets.projects ?? []} />
        )}
      </section>

      {toast && <div className="debug-toast">{toast}</div>}
    </div>
  );
}
