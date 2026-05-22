import { isKioskResolution, KIOSK_HEIGHT, KIOSK_WIDTH } from "./kiosk";

/** True on Pi kiosk Chromium or 1024×600 dev emulation. */
export function isKioskHardware(): boolean {
  if (typeof window === "undefined") return false;
  if (window.navigator.userAgent.includes("ConciergeKiosk")) return true;
  return isKioskResolution(window.screen.width, window.screen.height);
}

/** ALSA / Seeed HAT needs longer gaps between Web Speech sessions. */
export function micReleaseDelayMs(): number {
  return isKioskHardware() ? 1400 : 700;
}

/** Pause before voice-mode auto re-listen after TTS or agent reply. */
export function voiceListenGapMs(): number {
  return isKioskHardware() ? 2400 : 1200;
}

export { KIOSK_WIDTH, KIOSK_HEIGHT };
