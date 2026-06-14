import { Link, useNavigate } from "react-router-dom";
import { StickyNote, ChevronRight, Pin } from "lucide-react";
import type { Note } from "@concierge/shared";
import type { AppMode } from "../context/AppPrefsContext";

interface Props {
  notes: Note[];
  mode?: AppMode;
}

export default function NotesPanel({ notes, mode = "work" }: Props) {
  const navigate = useNavigate();
  const shown = notes.slice(0, 8);
  const empty =
    mode === "work" ? "No work notes" : "No personal notes yet";

  return (
    <article className="dash-card">
      <header className="dash-card__header">
        <StickyNote size={18} />
        <span>Notes</span>
      </header>
      {shown.length === 0 ? (
        <p className="reminder-empty">{empty}</p>
      ) : (
        <ul className="reminder-list">
          {shown.map((n, i) => (
            <li key={n.id}>
              <button
                type="button"
                className="reminder-item reminder-item--tappable"
                onClick={() => navigate(`/notes/${n.id}`)}
              >
                <span
                  className={`reminder-item__dot reminder-item__dot--${i % 2 === 0 ? "blue" : "accent"}`}
                />
                <div className="reminder-item__main">
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
              </button>
            </li>
          ))}
        </ul>
      )}
      <footer className="dash-card__footer">
        <Link to="/notes" className="dash-card__footer-btn">
          All notes
          <ChevronRight size={16} />
        </Link>
      </footer>
    </article>
  );
}
