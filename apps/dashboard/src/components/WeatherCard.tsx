import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import type { Weather } from "@concierge/shared";
import WeatherIconDisplay from "./WeatherIcon";

interface Props {
  weather: Weather | null;
  needsCity: boolean;
  loading: boolean;
  compact?: boolean;
  variant?: "default" | "top";
}

function unitSymbol(unit: Weather["unit"]): string {
  return unit === "fahrenheit" ? "°F" : "°C";
}

export default function WeatherCard({
  weather,
  needsCity,
  loading,
  compact,
  variant = "default",
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

  const sym = unitSymbol(weather.unit);

  if (variant === "top") {
    return (
      <Link to="/settings" className="weather-card weather-card--top">
        <WeatherIconDisplay icon={weather.icon} />
        <div className="weather-card__main">
          <span className="weather-card__temp">
            {weather.temperature}
            {sym}
          </span>
          <span className="weather-card__condition">
            {loading ? "Updating…" : weather.condition}
          </span>
          <span className="weather-card__location">
            <MapPin size={12} />
            {weather.city}
          </span>
        </div>
        {(weather.high != null || weather.low != null) && (
          <div className="weather-card__hilo">
            {weather.high != null && <span>H {weather.high}°</span>}
            {weather.low != null && <span>L {weather.low}°</span>}
          </div>
        )}
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
          {sym}
        </span>
        <span className="weather-card__condition">
          {loading ? "Updating…" : weather.condition}
        </span>
        <span className="weather-card__city">{weather.city}</span>
      </div>
    </Link>
  );
}
