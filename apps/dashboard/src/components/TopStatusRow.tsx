import type { DashboardState } from "@concierge/shared";
import ClockHero from "./ClockHero";
import WeatherCard from "./WeatherCard";
import GatewayStatusChip from "./GatewayStatusChip";

interface Props {
  state: DashboardState | null;
  needsCity: boolean;
  weatherLoading: boolean;
  onClockTap: () => void;
  onRefreshGateway: () => void;
}

export default function TopStatusRow({
  state,
  needsCity,
  weatherLoading,
  onClockTap,
  onRefreshGateway,
}: Props) {
  const weather = state?.widgets.weather.data ?? null;

  return (
    <section className="home-top-row">
      <div className="dash-card clock-card">
        <ClockHero onTap={onClockTap} />
      </div>
      <div className="dash-card">
        <WeatherCard
          weather={weather}
          needsCity={needsCity}
          loading={weatherLoading}
          variant="top"
        />
      </div>
      <GatewayStatusChip
        health={state?.openclaw ?? null}
        mock={state?.api.mock}
        onRefresh={onRefreshGateway}
      />
    </section>
  );
}
