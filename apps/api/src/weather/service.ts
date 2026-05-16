import type { Weather, WeatherIcon } from "@concierge/shared";
import { getAppSettings } from "../settings.js";

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const CACHE_MS =
  Number(process.env.WEATHER_CACHE_MINUTES ?? 15) * 60 * 1000;

let cached: Weather | null = null;
let cachedAt = 0;

function wmoToIcon(code: number): WeatherIcon {
  if (code === 0) return "clear";
  if (code <= 3) return "partly_cloudy";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain";
  if (code <= 86) return "snow";
  if (code <= 99) return "thunderstorm";
  return "unknown";
}

function wmoToLabel(code: number): string {
  const labels: Record<number, string> = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Foggy",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Heavy showers",
    95: "Thunderstorm",
  };
  return labels[code] ?? "Unknown";
}

export async function geocodeCity(
  city: string,
): Promise<{ name: string; latitude: number; longitude: number }> {
  const params = new URLSearchParams({
    name: city.trim(),
    count: "1",
    language: "en",
    format: "json",
  });
  const res = await fetch(`${GEOCODE_URL}?${params}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("Geocoding failed");
  const data = (await res.json()) as {
    results?: Array<{
      name: string;
      latitude: number;
      longitude: number;
      admin1?: string;
      country?: string;
    }>;
  };
  const hit = data.results?.[0];
  if (!hit) throw new Error(`City not found: ${city}`);
  const label = [hit.name, hit.admin1, hit.country].filter(Boolean).join(", ");
  return { name: label, latitude: hit.latitude, longitude: hit.longitude };
}

async function fetchForecast(
  lat: number,
  lon: number,
  cityLabel: string,
): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,apparent_temperature,weather_code",
    timezone: "auto",
  });
  const res = await fetch(`${FORECAST_URL}?${params}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("Weather fetch failed");
  const data = (await res.json()) as {
    current: {
      temperature_2m: number;
      apparent_temperature: number;
      weather_code: number;
    };
  };
  const code = data.current.weather_code;
  return {
    city: cityLabel,
    temperature: Math.round(data.current.temperature_2m),
    apparentTemperature: Math.round(data.current.apparent_temperature),
    condition: wmoToLabel(code),
    icon: wmoToIcon(code),
    fetchedAt: new Date().toISOString(),
  };
}

export async function getWeather(force = false): Promise<Weather | null> {
  const settings = getAppSettings();
  if (
    settings.latitude == null ||
    settings.longitude == null ||
    !settings.city
  ) {
    return null;
  }

  const now = Date.now();
  if (!force && cached && now - cachedAt < CACHE_MS) {
    return cached;
  }

  const weather = await fetchForecast(
    settings.latitude,
    settings.longitude,
    settings.city,
  );
  cached = weather;
  cachedAt = now;
  return weather;
}

export function clearWeatherCache(): void {
  cached = null;
  cachedAt = 0;
}
