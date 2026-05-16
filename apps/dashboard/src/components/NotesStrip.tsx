import type { Note } from "@concierge/shared";

interface Props {
  notes: Note[];
  onDismiss: (id: number) => void;
  compact?: boolean;
}

export default function NotesStrip({ notes, onDismiss, compact }: Props) {
  if (notes.length === 0) return null;
  const shown = compact ? notes.slice(0, 1) : notes;

  return (
    <div className={`feed-card feed-card--notes${compact ? " feed-card--compact" : ""}`}>
      <div className="feed-card__title">Notes</div>
      <ul className="feed-list">
        {shown.map((n) => (
          <li key={n.id} className="feed-item">
            <button
              type="button"
              className="feed-item__body"
              onClick={() => void onDismiss(n.id)}
            >
              <span className="feed-item__text">{n.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
