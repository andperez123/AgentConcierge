import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ProjectBreakdown } from "@concierge/shared";
import { fetchProjectBreakdown, postWorkEntityAction } from "../api";
import { ChevronLeft } from "lucide-react";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ProjectBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setData(await fetchProjectBreakdown(id));
      setError(null);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load project");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function askAgent() {
    if (!id) return;
    setBusy(true);
    try {
      await postWorkEntityAction("project", id, { action: "ask-agent" });
    } finally {
      setBusy(false);
    }
  }

  if (!id) {
    return (
      <div className="page-shell page-shell--project">
        <div className="page-shell__body">
          <p className="reminder-empty">Invalid project</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--project">
      <header className="page-shell__header">
        <Link to="/work?tab=projects" className="project-detail__back">
          <ChevronLeft size={20} />
          Projects
        </Link>
        {error && <p className="work-sheet__error">{error}</p>}
        {data && (
          <>
            <h1 className="page-title">{data.project.name}</h1>
            {data.project.summary && (
              <p className="page-subtitle">{data.project.summary}</p>
            )}
            {data.project.path && (
              <p className="project-detail__path">{data.project.path}</p>
            )}
            <button
              type="button"
              className="action-card action-card--primary project-detail__agent"
              disabled={busy}
              onClick={() => void askAgent()}
            >
              {busy ? "Sending…" : "Ask agent about this project"}
            </button>
          </>
        )}
      </header>

      {data && (
        <div className="page-shell__body">
          {data.sections.map((section) => (
            <section key={section.title} className="project-detail__section">
              <h2 className="project-detail__section-title">{section.title}</h2>
              <ul className="project-detail__items">
                {section.items.map((item) => (
                  <li key={item.label}>
                    <strong>{item.label}</strong>
                    {item.detail && (
                      <p className="project-detail__item-detail">{item.detail}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {(data.linkedReminders.length > 0 || data.linkedNotes.length > 0) && (
            <section className="project-detail__section">
              <h2 className="project-detail__section-title">Desk items</h2>
              <ul className="list-page-items">
                {data.linkedReminders.map((r) => (
                  <li key={`r-${r.id}`}>
                    <span className="list-page-item">⏰ {r.text}</span>
                  </li>
                ))}
                {data.linkedNotes.map((n) => (
                  <li key={`n-${n.id}`}>
                    <span className="list-page-item">📝 {n.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
