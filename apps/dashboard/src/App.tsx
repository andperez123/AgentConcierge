import { Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { reportScreen } from "./api";
import Home from "./pages/Home";
import Detail from "./pages/Detail";
import Logs from "./pages/Logs";

export default function App() {
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
    </Routes>
  );
}
