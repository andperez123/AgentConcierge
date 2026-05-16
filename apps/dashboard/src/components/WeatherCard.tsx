import { Link } from "react-router-dom";
import type { Weather } from "@concierge/shared";
import WeatherIconDisplay from "./WeatherIcon";

interface Props {
  weather: Weather | null;
  needsCity: boolean;
  loading: boolean;
}

export default function WeatherCard({ weather, needsCity, loading }: Props) {
  if (needsCity || !weather) {
    return (
      <Link to="/settings" className="weather-card weather-card--empty">
        <span className="weather-card__label">Weather</span>
        <span className="weather-card__cta">Tap to set city</span>
      </Link>
    );
  }

  return (
    <Link to="/settings" className="weather-card">
      <div className="weather-card__icon">
        <WeatherIconDisplay icon={weather.icon} />
      </div>
      <div className="weather-card__body">
        <span className="weather-card__temp">{weather.temperature}°</span>
        <span className="weather-card__condition">
          {loading ? "Updating…" : weather.condition}
        </span>
        <span className="weather-card__city">{weather.city}</span>
      </div>
    </Link>
  );
}
