import { Link } from "react-router-dom";
import type { Weather } from "@concierge/shared";
import WeatherIconDisplay from "./WeatherIcon";

interface Props {
  weather: Weather | null;
  needsCity: boolean;
  loading: boolean;
  compact?: boolean;
}

function minutesAgo(iso: string): string {
  const min = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (min < 1) return "Updated just now";
  if (min === 1) return "Updated 1m ago";
  return `Updated ${min}m ago`;
}

function unitSymbol(unit: Weather["unit"]): string {
  return unit === "fahrenheit" ? "°F" : "°C";
}

export default function WeatherCard({
  weather,
  needsCity,
  loading,
  compact,
}: Props) {
  if (needsCity || !weather) {
    return (
      <Link
        to="/settings"
        className={`weather-card weather-card--empty${compact ? " weather-card--compact" : ""}`}
      >
        <span className="weather-card__label">Weather</span>
        <span className="weather-card__cta">Tap to set city</span>
      </Link>
    );
  }

  if (compact) {
    return (
      <Link to="/settings" className="weather-card weather-card--compact">
        <WeatherIconDisplay icon={weather.icon} />
        <span className="weather-card__temp">
          {weather.temperature}
          {unitSymbol(weather.unit)}
        </span>
      </Link>
    );
  }

  return (
    <Link to="/settings" className="weather-card">
      <div className="weather-card__icon">
        <WeatherIconDisplay icon={weather.icon} />
      </div>
      <div className="weather-card__body">
        <span className="weather-card__temp">
          {weather.temperature}
          {unitSymbol(weather.unit)}
        </span>
        <span className="weather-card__condition">
          {loading ? "Updating…" : weather.condition}
        </span>
        <span className="weather-card__city">{weather.city}</span>
        <span className="weather-card__updated">
          {minutesAgo(weather.fetchedAt)}
        </span>
      </div>
    </Link>
  );
}
