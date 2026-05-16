import type { DashboardState, Reminder, Note } from "@concierge/shared";
import WeatherCard from "./WeatherCard";
import RemindersCard from "./RemindersCard";
import NotesStrip from "./NotesStrip";
import DeviceHealthCard from "./DeviceHealthCard";

interface Props {
  state: DashboardState;
  needsCity: boolean;
  weatherLoading: boolean;
  onDismissReminder: (id: number) => void;
  onDismissNote: (id: number) => void;
}

export default function UtilityRow({
  state,
  needsCity,
  weatherLoading,
  onDismissReminder,
  onDismissNote,
}: Props) {
  const weather = state.widgets.weather.data ?? null;
  const stale = state.widgets.weather.stale;

  return (
    <div className="utility-row">
      <div className="utility-row__weather">
        <WeatherCard
          weather={weather}
          needsCity={needsCity}
          loading={weatherLoading}
          compact
        />
        {stale && <span className="stale-badge stale-badge--inline">Stale</span>}
      </div>
      <RemindersCard
        reminders={state.widgets.reminders as Reminder[]}
        onDismiss={onDismissReminder}
        compact
      />
      <NotesStrip
        notes={state.widgets.notes as Note[]}
        onDismiss={onDismissNote}
        compact
      />
      {state.device?.metrics && (
        <DeviceHealthCard metrics={state.device.metrics} compact />
      )}
    </div>
  );
}
