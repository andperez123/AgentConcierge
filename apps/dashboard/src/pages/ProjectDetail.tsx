import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ProjectBreakdown, ProjectTask } from "@concierge/shared";
import {
  fetchProjectBreakdown,
  fetchProjects,
  postWorkEntityAction,
} from "../api";
import WorkItemSheet, { type WorkItem } from "../components/WorkItemSheet";
import { formatReminderTime } from "../utils/format";
import { ChevronLeft, Circle, CircleCheck } from "lucide-react";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ProjectBreakdown | null>(null);
  const [projects, setProjects] = useState<
    Awaited<ReturnType<typeof fetchProjects>>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<WorkItem | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [breakdown, projectList] = await Promise.all([
        fetchProjectBreakdown(id),
        fetchProjects(),
      ]);
      setData(breakdown);
      setProjects(projectList);
      setError(null);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load project");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const tasksByGroup = useMemo(() => {
    const groups = new Map<string | undefined, ProjectTask[]>();
    for (const t of data?.tasks ?? []) {
      const key = t.group;
      const list = groups.get(key) ?? [];
      list.push(t);
      groups.set(key, list);
    }
    return groups;
  }, [data?.tasks]);

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

  const progress = data?.taskProgress;
  const progressPct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <div className="page-shell page-shell--project">
      <header className="page-shell__header project-detail__header">
        <Link to="/work?tab=projects" className="project-detail__back">
          <ChevronLeft size={20} />
          Projects
        </Link>
        {error && <p className="work-sheet__error">{error}</p>}
        {data && (
          <>
            <div className="project-detail__title-row">
              <h1 className="page-title project-detail__title">
                {data.project.name}
              </h1>
              {data.overview?.status && (
                <span className="project-detail__status">
                  {data.overview.status}
                </span>
              )}
            </div>
            {data.overview?.nextFocus && (
              <p className="project-detail__next-focus">
                <strong>Next:</strong> {data.overview.nextFocus}
              </p>
            )}
            {!data.overview?.nextFocus && data.project.summary && (
              <p className="page-subtitle">{data.project.summary}</p>
            )}
            {data.project.path && (
              <p className="project-detail__path" title={data.project.path}>
                {data.project.path}
              </p>
            )}
            {data.project.updatedAt && (
              <p className="project-detail__updated">
                Updated {data.project.updatedAt.slice(0, 10)}
              </p>
            )}
            <button
              type="button"
              className="dash-card__footer-btn project-detail__agent"
              disabled={busy}
              onClick={() => void askAgent()}
            >
              {busy ? "Sending…" : "Ask agent about this project"}
            </button>
          </>
        )}
      </header>

      {data && (
        <div className="page-shell__body project-detail__body">
          {data.overview && data.overview.sections.length > 0 && (
            <section className="project-detail__card project-overview">
              <h2 className="project-detail__section-title">Overview</h2>
              {data.overview.sections.map((sec) => (
                <div key={sec.title} className="project-overview__block">
                  <h3 className="project-overview__heading">{sec.title}</h3>
                  <p className="project-overview__body">{sec.body}</p>
                </div>
              ))}
            </section>
          )}

          {data.tasks && data.tasks.length > 0 && (
            <section className="project-detail__card project-tasks">
              <div className="project-tasks__head">
                <h2 className="project-detail__section-title">Tasks</h2>
                {progress && (
                  <span className="project-tasks__count">
                    {progress.done}/{progress.total}
                  </span>
                )}
              </div>
              {progress && progress.total > 0 && (
                <div
                  className="project-progress"
                  role="progressbar"
                  aria-valuenow={progress.done}
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                >
                  <div
                    className="project-progress__fill"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}
              {[...tasksByGroup.entries()].map(([group, items]) => (
                <div key={group ?? "_"} className="project-tasks__group">
                  {group && (
                    <h3 className="project-tasks__group-title">{group}</h3>
                  )}
                  <ul className="project-tasks__list">
                    {items?.map((t) => (
                      <li
                        key={t.id}
                        className={`project-task${t.done ? " project-task--done" : ""}`}
                      >
                        {t.done ? (
                          <CircleCheck
                            size={22}
                            className="project-task__icon"
                            aria-hidden
                          />
                        ) : (
                          <Circle
                            size={22}
                            className="project-task__icon"
                            aria-hidden
                          />
                        )}
                        <span className="project-task__text">{t.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}

          {(data.linkedReminders.length > 0 || data.linkedNotes.length > 0) && (
            <section className="project-detail__card">
              <h2 className="project-detail__section-title">Desk items</h2>
              <ul className="list-page-items">
                {data.linkedReminders.map((r) => (
                  <li key={`r-${r.id}`}>
                    <button
                      type="button"
                      className="list-page-item"
                      onClick={() =>
                        setSelection({ kind: "reminder", item: r })
                      }
                    >
                      ⏰ {r.text}
                      <span className="list-page-item__meta">
                        {formatReminderTime(r.dueAt) ?? "reminder"}
                      </span>
                    </button>
                  </li>
                ))}
                {data.linkedNotes.map((n) => (
                  <li key={`n-${n.id}`}>
                    <button
                      type="button"
                      className="list-page-item"
                      onClick={() => setSelection({ kind: "note", item: n })}
                    >
                      📝 {n.text}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.sections.length > 0 && (
            <details className="project-detail__docs">
              <summary className="project-detail__section-title">
                Documents &amp; folders
              </summary>
              {data.sections.map((section) => (
                <section key={section.title} className="project-detail__section">
                  <h3 className="project-detail__subsection-title">
                    {section.title}
                  </h3>
                  <ul className="project-detail__items">
                    {section.items.map((item) => (
                      <li key={item.label}>
                        <strong>{item.label}</strong>
                        {item.detail && (
                          <p className="project-detail__item-detail">
                            {item.detail}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </details>
          )}
        </div>
      )}

      <WorkItemSheet
        selection={selection}
        projects={projects}
        onClose={() => setSelection(null)}
        onSaved={() => void load()}
        enableActions
      />
    </div>
  );
}
