import { useEffect } from "react";
import { isKioskResolution } from "../lib/kiosk";

export function detectDensity(): string {
  const w = window.screen.width;
  const h = window.screen.height;
  const kioskUa = window.navigator.userAgent.includes("ConciergeKiosk");
  if (isKioskResolution(w, h) || kioskUa) return "kiosk";
  /* compact: narrow windows — use kiosk layout rules */
  if (Math.min(w, h) <= 600) return "kiosk";
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
