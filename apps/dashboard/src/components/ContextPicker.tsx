import type { WorkContext } from "@concierge/shared";

interface Props {
  value: WorkContext;
  onChange: (next: WorkContext) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{ id: WorkContext; label: string }> = [
  { id: "work", label: "Work" },
  { id: "life", label: "Life" },
  { id: null, label: "Both" },
];

export default function ContextPicker({ value, onChange, disabled }: Props) {
  return (
    <div className="context-picker" role="group" aria-label="Work or Life context">
      {OPTIONS.map((opt) => (
        <button
          key={opt.label}
          type="button"
          className={`context-picker__btn${value === opt.id ? " context-picker__btn--active" : ""}`}
          disabled={disabled}
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
