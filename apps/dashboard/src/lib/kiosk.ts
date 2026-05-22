/** ELECROW 7" kiosk — 1024×600 landscape (see skills/concierge-display) */
export const KIOSK_WIDTH = 1024;
export const KIOSK_HEIGHT = 600;
export const KIOSK_NAV_HEIGHT = 80;

export const KIOSK_CONTENT_HEIGHT = KIOSK_HEIGHT - KIOSK_NAV_HEIGHT;

export function isKioskResolution(width: number, height: number): boolean {
  return width === KIOSK_WIDTH && height === KIOSK_HEIGHT;
}
