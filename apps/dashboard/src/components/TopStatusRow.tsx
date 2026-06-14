import type { DashboardState } from "@concierge/shared";
import { useAppPrefs, type AppMode } from "../context/AppPrefsContext";
import ClockHero from "./ClockHero";
import WeatherCard from "./WeatherCard";
import GatewayStatusChip from "./GatewayStatusChip";
import ModeThemeControls from "./ModeThemeControls";

interface Props {
  state: DashboardState | null;
  needsCity: boolean;
  onClockTap: () => void;
}

const MODE_COPY: Record<AppMode, { title: string }> = {
  work: { title: "Work" },
  life: { title: "Life" },
};

export default function TopStatusRow({
  state,
  needsCity,
  onClockTap,
}: Props) {
  const { mode } = useAppPrefs();
  const weather = state?.widgets.weather.data ?? null;
  const copy = MODE_COPY[mode];

  return (
    <>
      <header className="home-header-bar">
        <div className="home-header-bar__copy">
          <h1 className="home-header-bar__title">{copy.title}</h1>
        </div>
        <div className="home-header-bar__tools">
          <GatewayStatusChip
            variant="icon"
            health={state?.openclaw ?? null}
            mock={state?.api.mock}
          />
          <ModeThemeControls compact />
        </div>
      </header>
      <section className="home-top-row home-top-row--compact">
        <div className="dash-card clock-card">
          <ClockHero onTap={onClockTap} />
        </div>
        <div className="dash-card">
          <WeatherCard
            weather={weather}
            needsCity={needsCity}
            loading={false}
            variant="top"
          />
        </div>
      </section>
    </>
  );
}
