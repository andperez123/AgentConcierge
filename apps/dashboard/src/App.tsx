import { Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { reportScreen } from "./api";
import { useDensity } from "./hooks/useDensity";
import Home from "./pages/Home";
import Detail from "./pages/Detail";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";
import Debug from "./pages/Debug";
import Incident from "./pages/Incident";
import TaskReauth from "./pages/TaskReauth";
import TaskRecovery from "./pages/TaskRecovery";
import TaskVoice from "./pages/TaskVoice";

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
      <Route path="/" element={<Home />} />
      <Route path="/openclaw" element={<Detail />} />
      <Route path="/logs" element={<Logs />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/debug" element={<Debug />} />
      <Route path="/incident/:alertId" element={<Incident />} />
      <Route path="/task/reauth" element={<TaskReauth />} />
      <Route path="/task/recovery" element={<TaskRecovery />} />
      <Route path="/task/voice" element={<TaskVoice />} />
    </Routes>
  );
}
