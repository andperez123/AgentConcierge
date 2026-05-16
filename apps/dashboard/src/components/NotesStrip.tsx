import type { Note } from "@concierge/shared";

interface Props {
  notes: Note[];
  onDismiss: (id: number) => void;
}

export default function NotesStrip({ notes, onDismiss }: Props) {
  if (notes.length === 0) return null;

  return (
    <div className="feed-card feed-card--notes">
      <div className="feed-card__title">Notes</div>
      <ul className="feed-list">
        {notes.map((n) => (
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
