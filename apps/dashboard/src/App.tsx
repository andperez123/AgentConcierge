import { Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { reportScreen } from "./api";
import { useDensity } from "./hooks/useDensity";
import AppShell from "./components/AppShell";
import Home from "./pages/Home";
import Detail from "./pages/Detail";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";
import Debug from "./pages/Debug";
import Incident from "./pages/Incident";
import TaskReauth from "./pages/TaskReauth";
import TaskRecovery from "./pages/TaskRecovery";
import TaskVoice from "./pages/TaskVoice";
import TaskChat from "./pages/TaskChat";
import Work from "./pages/Work";
import RemindersPage from "./pages/RemindersPage";
import Calendar from "./pages/Calendar";
import ReminderDetailPage from "./pages/ReminderDetailPage";
import NotesPage from "./pages/NotesPage";
import NoteDetailPage from "./pages/NoteDetailPage";
import ProjectDetail from "./pages/ProjectDetail";

export default function App() {
  useDensity();

  useEffect(() => {
    const kiosk =
      document.querySelector('meta[name="concierge-kiosk"]') !== null ||
      window.navigator.userAgent.includes("ConciergeKiosk");
    void reportScreen(screen.width, screen.height, kiosk);
  }, []);

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/openclaw" element={<Detail />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/debug" element={<Debug />} />
        <Route path="/work" element={<Work />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/notes/:id" element={<NoteDetailPage />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="/reminders/:id" element={<ReminderDetailPage />} />
        <Route path="/incident/:alertId" element={<Incident />} />
        <Route path="/task/reauth" element={<TaskReauth />} />
        <Route path="/task/recovery" element={<TaskRecovery />} />
        <Route path="/task/voice" element={<TaskVoice />} />
        <Route path="/task/chat" element={<TaskChat />} />
      </Route>
    </Routes>
  );
}
