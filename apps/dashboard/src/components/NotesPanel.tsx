import { Link } from "react-router-dom";
import { StickyNote, ChevronRight, Pin } from "lucide-react";
import type { Note } from "@concierge/shared";

interface Props {
  notes: Note[];
}

export default function NotesPanel({ notes }: Props) {
  const shown = notes.slice(0, 3);

  return (
    <article className="dash-card">
      <header className="dash-card__header">
        <StickyNote size={18} />
        <span>Notes</span>
      </header>
      {shown.length === 0 ? (
        <p className="reminder-empty">No notes on the desk</p>
      ) : (
        <ul className="reminder-list">
          {shown.map((n, i) => (
            <li key={n.id} className="reminder-item">
              <span
                className={`reminder-item__dot reminder-item__dot--${i % 2 === 0 ? "blue" : "accent"}`}
              />
              <div>
                <div className="reminder-item__title">
                  {n.pinned && (
                    <Pin
                      size={12}
                      style={{ display: "inline", marginRight: 4 }}
                    />
                  )}
                  {n.text}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <footer className="dash-card__footer">
        <Link to="/work" className="dash-card__footer-btn">
          Open Work
          <ChevronRight size={16} />
        </Link>
      </footer>
    </article>
  );
}
