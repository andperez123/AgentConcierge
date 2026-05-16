import type { WeatherIcon as Icon } from "@concierge/shared";

const props = { width: 56, height: 56, stroke: "currentColor", fill: "none", strokeWidth: 1.8 };

export default function WeatherIconDisplay({ icon }: { icon: Icon }) {
  switch (icon) {
    case "clear":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" fill="#fbbf24" stroke="none" />
          <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5 19 5" />
        </svg>
      );
    case "partly_cloudy":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <circle cx="8" cy="9" r="3" fill="#fbbf24" stroke="none" />
          <path d="M7 18h9a4 4 0 0 0 0-8 5 5 0 0 0-9.8-1.2" fill="#94a3b8" stroke="none" />
        </svg>
      );
    case "rain":
    case "drizzle":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <path d="M7 16h9a4 4 0 0 0 0-8 5 5 0 0 0-9.8-1.2" fill="#94a3b8" stroke="none" />
          <path d="M8 19v3M12 19v3M16 19v3" />
        </svg>
      );
    case "snow":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <path d="M7 15h9a4 4 0 0 0 0-8 5 5 0 0 0-9.8-1.2" fill="#94a3b8" stroke="none" />
          <path d="M12 17v3M9 18.5l6-3M15 18.5l-6-3" />
        </svg>
      );
    case "thunderstorm":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <path d="M7 14h9a4 4 0 0 0 0-8 5 5 0 0 0-9.8-1.2" fill="#64748b" stroke="none" />
          <path d="M11 16l-2 4h3l-2 4" fill="#fbbf24" stroke="none" />
        </svg>
      );
    case "fog":
    case "cloudy":
    default:
      return (
        <svg {...props} viewBox="0 0 24 24">
          <path d="M7 16h11a4 4 0 0 0 0-8 5 5 0 0 0-10.2-1.4" fill="#94a3b8" stroke="none" />
        </svg>
      );
  }
}
