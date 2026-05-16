import type { ReactNode } from "react";

interface Props {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  icon?: ReactNode;
}

export default function ActionTile({
  label,
  onClick,
  variant = "secondary",
  disabled,
  icon,
}: Props) {
  return (
    <button
      type="button"
      className={`action-tile action-tile--${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="action-tile__icon">{icon}</span>}
      <span className="action-tile__label">{label}</span>
    </button>
  );
}
