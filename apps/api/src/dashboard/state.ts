import type { DashboardState, Weather } from "@concierge/shared";
import { MOCK_OPENCLAW, VERSION } from "../config.js";
import { getSnapshot, saveSnapshot } from "../db.js";
import { listAlerts, syncHealthAlert } from "../alerts.js";
import { buildDashboardActions } from "./actions.js";
import { mapToSystemHealth } from "../openclaw/health.js";
import { getOpenClawStatus } from "../openclaw/adapter.js";
import { getWeather } from "../weather/service.js";
import { listReminders } from "../reminders.js";
import { listNotes } from "../notes.js";
import { getHeroDisplay } from "../display/hero.js";
import {
  arch as osArch,
  hostname,
  platform as osPlatform,
  uptime,
} from "node:os";
import {
  collectDeviceMetrics,
  checkNetworkOnline,
} from "../device/metrics.js";

let clientScreen: { width: number; height: number } | undefined;
let touchTestCount = 0;
let clientKiosk = false;

export function setClientScreen(
  width: number,
  height: number,
  kiosk: boolean,
): void {
  clientScreen = { width, height };
  clientKiosk = kiosk;
}

export function incrementTouchTest(): number {
  touchTestCount += 1;
  return touchTestCount;
}

export function getTouchTestCount(): number {
  return touchTestCount;
}

export function getClientScreenInfo(): {
  screen?: { width: number; height: number };
  kiosk: boolean;
} {
  return { screen: clientScreen, kiosk: clientKiosk };
}

const STALE_MS = 120_000;

function isStale(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() > STALE_MS;
}

async function loadWeatherWithCache(force: boolean): Promise<{
  data: Weather | null;
  stale: boolean;
  lastGoodAt?: string;
}> {
  try {
    const weather = await getWeather(force);
    if (weather) {
      saveSnapshot("weather", JSON.stringify(weather));
      return { data: weather, stale: false, lastGoodAt: weather.fetchedAt };
    }
  } catch {
    /* fall through */
  }
  const snap = getSnapshot("weather");
  if (snap) {
    return {
      data: JSON.parse(snap.json) as Weather,
      stale: isStale(snap.fetchedAt),
      lastGoodAt: snap.fetchedAt,
    };
  }
  return { data: null, stale: true };
}

export async function buildDashboardState(force = false): Promise<DashboardState> {
  let status = null;
  let statusError: string | null = null;
  try {
    status = await getOpenClawStatus(force);
    saveSnapshot("health", JSON.stringify(status));
  } catch (err) {
    statusError = err instanceof Error ? err.message : "Status failed";
    const snap = getSnapshot("health");
    if (snap) {
      status = JSON.parse(snap.json) as typeof status;
    }
  }

  const openclaw = mapToSystemHealth(status, statusError);
  const healthSnap = getSnapshot("health");
  if (healthSnap && !status) {
    openclaw.stale = true;
  }

  syncHealthAlert(openclaw.summary, openclaw.state);

  const weatherWidget = await loadWeatherWithCache(force);
  const metrics = collectDeviceMetrics();
  const networkOnline = await checkNetworkOnline();

  const device = {
    hostname: hostname(),
    uptimeSeconds: Math.floor(uptime()),
    platform: osPlatform(),
    arch: osArch(),
    screen: clientScreen,
    kiosk: clientKiosk,
    touchTestCount,
    metrics,
    networkOnline,
  };
  saveSnapshot("device", JSON.stringify(device));

  return {
    screen: { mode: "home", device: clientKiosk ? "kiosk" : "browser" },
    openclaw,
    alerts: listAlerts(true),
    actions: buildDashboardActions(openclaw.state),
    widgets: {
      weather: {
        stale: weatherWidget.stale,
        lastGoodAt: weatherWidget.lastGoodAt,
        data: weatherWidget.data,
      },
      hero: getHeroDisplay(),
      reminders: listReminders().slice(0, 5),
      notes: listNotes().slice(0, 3),
    },
    device,
    api: { ok: true, version: VERSION, mock: MOCK_OPENCLAW },
    checkedAt: new Date().toISOString(),
  };
}
