import type { DeviceMetric } from "@concierge/shared";

interface Props {
  metrics: DeviceMetric[];
  compact?: boolean;
}

export default function DeviceHealthCard({ metrics, compact }: Props) {
  const shown = compact ? metrics.slice(0, 2) : metrics;
  return (
    <div className={`device-card${compact ? " device-card--compact" : ""}`}>
      <div className="device-card__title">Device</div>
      <ul className="device-metrics">
        {shown.map((m) => (
          <li key={m.label} className={`device-metric device-metric--${m.level}`}>
            <span>{m.label}</span>
            <span>{m.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
