import { useClock } from "../hooks/useClock";

interface Props {
  onTap?: () => void;
}

export default function ClockHero({ onTap }: Props) {
  const { time, seconds, date } = useClock();

  return (
    <button
      type="button"
      className="clock-hero clock-hero--btn"
      onClick={onTap}
    >
      <div className="clock-time">
        <span className="clock-hours">{time}</span>
        <span className="clock-seconds">:{seconds}</span>
      </div>
      <div className="clock-date">{date}</div>
    </button>
  );
}
