import { useState } from "react";
import {
  dueAtHour,
  dueInOneHour,
  dueTonight,
  dueTomorrow9am,
} from "../utils/format";

const PICK_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

interface Props {
  value: string | undefined;
  onChange: (dueAt: string | undefined) => void;
}

export default function DueTimePicker({ value, onChange }: Props) {
  const [pickOpen, setPickOpen] = useState(false);
  const [pickDay, setPickDay] = useState<0 | 1>(0);

  function selectPreset(next: string | undefined) {
    setPickOpen(false);
    onChange(next);
  }

  return (
    <div className="due-picker">
      <div className="due-picker__presets">
        <button
          type="button"
          className={`due-picker__chip${value === undefined ? " due-picker__chip--active" : ""}`}
          onClick={() => selectPreset(undefined)}
        >
          No Date
        </button>
        <button
          type="button"
          className="due-picker__chip"
          onClick={() => selectPreset(dueInOneHour())}
        >
          In 1 Hour
        </button>
        <button
          type="button"
          className="due-picker__chip"
          onClick={() => selectPreset(dueTonight())}
        >
          Tonight
        </button>
        <button
          type="button"
          className="due-picker__chip"
          onClick={() => selectPreset(dueTomorrow9am())}
        >
          Tomorrow 9 AM
        </button>
        <button
          type="button"
          className={`due-picker__chip${pickOpen ? " due-picker__chip--active" : ""}`}
          onClick={() => setPickOpen((o) => !o)}
        >
          Pick Time
        </button>
      </div>
      {pickOpen && (
        <div className="due-picker__custom">
          <div className="due-picker__day-toggle">
            <button
              type="button"
              className={`due-picker__day-btn${pickDay === 0 ? " due-picker__day-btn--active" : ""}`}
              onClick={() => setPickDay(0)}
            >
              Today
            </button>
            <button
              type="button"
              className={`due-picker__day-btn${pickDay === 1 ? " due-picker__day-btn--active" : ""}`}
              onClick={() => setPickDay(1)}
            >
              Tomorrow
            </button>
          </div>
          <div className="due-picker__hours">
            {PICK_HOURS.map((h) => {
              const label = new Date(2000, 0, 1, h).toLocaleTimeString([], {
                hour: "numeric",
              });
              return (
                <button
                  key={h}
                  type="button"
                  className="due-picker__hour"
                  onClick={() => selectPreset(dueAtHour(h, pickDay))}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
