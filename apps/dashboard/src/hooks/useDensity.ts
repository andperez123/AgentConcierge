import { useEffect } from "react";

export function detectDensity(): string {
  const w = window.screen.width;
  const h = window.screen.height;
  const kioskUa = window.navigator.userAgent.includes("ConciergeKiosk");
  if ((w === 1024 && h === 600) || kioskUa) return "kiosk";
  if (Math.min(w, h) <= 600) return "compact";
  if (w >= 1920) return "large";
  if (w >= 1280) return "standard";
  return "kiosk";
}

export function useDensity(): void {
  useEffect(() => {
    function apply() {
      document.documentElement.setAttribute("data-density", detectDensity());
    }
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);
}
