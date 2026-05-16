import { useClock } from "../hooks/useClock";

interface Props {
  onLongPress?: () => void;
}

export default function ClockHero({ onLongPress }: Props) {
  const { time, seconds, date } = useClock();

  function handlePointerDown() {
    if (!onLongPress) return;
    const timer = window.setTimeout(onLongPress, 2000);
    const clear = () => window.clearTimeout(timer);
    window.addEventListener("pointerup", clear, { once: true });
    window.addEventListener("pointercancel", clear, { once: true });
  }

  return (
    <div
      className="clock-hero"
      onPointerDown={handlePointerDown}
    >
      <div className="clock-time">
        <span className="clock-hours">{time}</span>
        <span className="clock-seconds">:{seconds}</span>
      </div>
      <div className="clock-date">{date}</div>
    </div>
  );
}
