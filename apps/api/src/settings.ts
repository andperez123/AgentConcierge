import { db } from "./db.js";

const KEYS = {
  city: "weather_city",
  lat: "weather_lat",
  lon: "weather_lon",
} as const;

export function getSetting(key: string): string | undefined {
  const row = db
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

export function getAppSettings(): {
  city?: string;
  latitude?: number;
  longitude?: number;
} {
  const city = getSetting(KEYS.city);
  const lat = getSetting(KEYS.lat);
  const lon = getSetting(KEYS.lon);
  return {
    city,
    latitude: lat ? Number(lat) : undefined,
    longitude: lon ? Number(lon) : undefined,
  };
}

export function saveWeatherLocation(
  city: string,
  latitude: number,
  longitude: number,
): void {
  setSetting(KEYS.city, city);
  setSetting(KEYS.lat, String(latitude));
  setSetting(KEYS.lon, String(longitude));
}
