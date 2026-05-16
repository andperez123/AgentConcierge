import { Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { reportScreen } from "./api";
import Home from "./pages/Home";
import Detail from "./pages/Detail";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";

const DESIGN_HEIGHT = 600;

function applyKioskScale() {
  const h = window.innerHeight;
  const scale = h > DESIGN_HEIGHT + 40 ? DESIGN_HEIGHT / h : 1;
  document.documentElement.style.setProperty("--kiosk-scale", String(scale));
  const root = document.getElementById("root");
  if (root) {
    if (scale < 1) root.classList.add("kiosk-scaled");
    else root.classList.remove("kiosk-scaled");
  }
}

export default function App() {
  useEffect(() => {
    const kiosk =
      document.querySelector('meta[name="concierge-kiosk"]') !== null ||
      window.navigator.userAgent.includes("ConciergeKiosk");
    void reportScreen(screen.width, screen.height, kiosk);

    applyKioskScale();
    window.addEventListener("resize", applyKioskScale);
    return () => window.removeEventListener("resize", applyKioskScale);
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/openclaw" element={<Detail />} />
      <Route path="/logs" element={<Logs />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}
