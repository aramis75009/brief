"use client";

/**
 * « Projets » sur iPhone.
 *
 * Le pendant mobile de la liste de projets de la sidebar desktop : où en est
 * chaque destination, en une carte et une jauge. C'est la seule vue mobile qui
 * répond à « qu'est-ce qui avance et qu'est-ce qui stagne ».
 *
 * La progression et la santé viennent de `status.ts` — les mêmes fonctions que
 * les portefeuilles desktop, pour que les deux écrans ne puissent pas afficher
 * deux chiffres différents du même projet.
 */

import { useMemo } from "react";
import { EmptyState } from "./EmptyState";
import { SkeletonCard } from "./Skeleton";
import { ProjectDot, TasksIcon } from "./icons";
import { shapeFor, skinFor } from "@/lib/projects";
import { plural } from "@/lib/plural";
import { HEALTH_LABEL, healthOf, progressPct, type PortfolioHealth } from "@/lib/status";
import type { Item, Project } from "@/lib/types";

const C = {
  surface: "var(--color-surface)",
  bg: "var(--color-bg)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
} as const;

const HEALTH_PASTEL: Record<PortfolioHealth, { bg: string; fg: string }> = {
  ontrack: { bg: "var(--color-meet-100)", fg: "var(--color-meet-700)" },
  atrisk: { bg: "var(--color-idea-100)", fg: "var(--color-idea-700)" },
  late: { bg: "var(--color-late-100)", fg: "var(--color-late-700)" },
};

export function ProjectsScreen({
  items,
  projects,
  loading,
  onOpenProject,
  onCapture,
}: {
  items: Item[];
  projects: Project[];
  loading: boolean;
  /** Ouvre « Mes tâches » filtré sur ce projet. */
  onOpenProject: (id: string) => void;
  onCapture: () => void;
}) {
  const now = useMemo(() => new Date(), []);
  const byId = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);

  const rows = useMemo(() => {
    return projects
      .filter((p) => !p.archived)
      .map((p) => {
        const tasks = items.filter(
          (it) => it.projectId === p.id && it.status !== "idea" && it.status !== "archived",
        );
        return {
          project: p,
          tasks,
          open: tasks.filter((it) => !it.doneAt).length,
          pct: progressPct(tasks),
          health: healthOf(tasks, now, byId),
        };
      })
      // Un projet vide passe APRÈS ceux qui ont du travail : il n'a rien à
      // raconter, et le montrer en tête pousse le reste sous la ligne de flottaison.
      .sort((a, b) => (b.tasks.length > 0 ? 1 : 0) - (a.tasks.length > 0 ? 1 : 0));
  }, [projects, items, now, byId]);

  return (
    <div className="min-h-0 flex-1 overflow-auto px-5 pb-2" style={{ animation: "fade .25s both" }}>
      <h2 className="mb-1 pt-1 text-[30px] font-extrabold tracking-[-0.035em]">Projets</h2>
      <p className="mb-5 text-[13.5px] font-medium leading-[1.45]" style={{ color: C.inkMuted }}>
        Où en est chaque destination.
      </p>

      {loading ? (
        <div className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<TasksIcon size={20} className="text-ink-faint" />}
          title="Aucun projet"
          description="Les projets se créent depuis le bureau, dans les réglages."
          actionLabel="Dicter"
          onAction={onCapture}
        />
      ) : (
        <div className="flex flex-col gap-3 pb-4">
          {rows.map(({ project, tasks, open, pct, health }) => {
            const skin = skinFor(project);
            const pastel = HEALTH_PASTEL[health];
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onOpenProject(project.id)}
                className="flex flex-col gap-2.75 text-left"
                style={{
                  background: C.surface,
                  borderRadius: 24,
                  padding: "16px 18px",
                  border: "none",
                  fontFamily: "inherit",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex-none" style={{ color: skin.bg }}>
                    <ProjectDot size={10} shape={shapeFor(project)} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{project.name}</span>
                  {tasks.length > 0 && (
                    <span
                      className="flex-none font-bold"
                      style={{ padding: "3px 9px", borderRadius: 999, fontSize: 10, background: pastel.bg, color: pastel.fg }}
                    >
                      {HEALTH_LABEL[health]}
                    </span>
                  )}
                  <span className="tnum flex-none text-[12px] font-bold" style={{ color: C.inkMuted }}>
                    {pct} %
                  </span>
                </div>

                <div style={{ height: 6, borderRadius: 99, background: C.bg, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      // Un minimum visible à 0 % : une jauge parfaitement vide
                      // est indiscernable de la piste, et le projet a l'air
                      // absent plutôt que pas commencé.
                      width: `${Math.max(pct, 3)}%`,
                      borderRadius: 99,
                      background: skin.bg,
                      transformOrigin: "left",
                      animation: "rail .5s cubic-bezier(.4,0,.2,1) both",
                    }}
                  />
                </div>

                <span className="text-[12px]" style={{ color: C.inkMuted }}>
                  {tasks.length === 0
                    ? "Aucune tâche"
                    : `${plural(tasks.length, "tâche")} · ${plural(open, "ouverte")}`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
