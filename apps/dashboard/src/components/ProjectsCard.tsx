import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, FolderKanban } from "lucide-react";
import type { DashboardProjectWidget } from "@concierge/shared";
import { formatProjectMeta } from "../utils/projectFormat";

interface Props {
  projects: DashboardProjectWidget[];
}

export default function ProjectsCard({ projects }: Props) {
  const navigate = useNavigate();
  const shown = projects.slice(0, 8);

  return (
    <article className="dash-card projects-card">
      <header className="dash-card__header">
        <FolderKanban size={18} />
        <span>Projects</span>
      </header>
      {shown.length === 0 ? (
        <p className="reminder-empty">
          No projects yet
          <span className="projects-card__hint">~/clawd/projects</span>
        </p>
      ) : (
        <ul className="reminder-list projects-card__list">
          {shown.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className="reminder-item reminder-item--tappable projects-card__row"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <span
                  className={`reminder-item__dot reminder-item__dot--${i % 2 === 0 ? "accent" : "blue"}`}
                />
                <div className="reminder-item__main">
                  <div className="reminder-item__title">{p.name}</div>
                  <div className="projects-card__meta">
                    {formatProjectMeta(p)}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <footer className="dash-card__footer">
        <Link to="/work?tab=projects" className="dash-card__footer-btn">
          All projects
          <ChevronRight size={16} />
        </Link>
      </footer>
    </article>
  );
}
