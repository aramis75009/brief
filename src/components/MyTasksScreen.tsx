"use client";

/**
 * « Mes tâches » sur iPhone — l'écran que la v1 mobile n'avait pas.
 *
 * L'accueil montre AUJOURD'HUI, l'agenda montre UN JOUR, la recherche montre
 * ce qu'on cherche. Rien ne montrait « tout ce qui m'attend », et c'est
 * précisément la question à laquelle Aramis veut une réponse au pouce.
 *
 * Groupement temporel par `buckets` — la même définition que
 * `/api/overview` et que la Liste desktop. Une seconde notion de « cette
 * semaine » finirait par diverger, et deux écrans afficheraient deux
 * chiffres différents pour la même chose.
 */

import { useMemo, useState } from "react";
import { EmptyState } from "./EmptyState";
import { SkeletonCard } from "./Skeleton";
import { CheckIcon, TaskCheckIcon } from "./icons";
import { shapeFor, skinFor } from "@/lib/projects";
import { PRIORITY_LABEL, statusOf } from "@/lib/status";
import { plural } from "@/lib/plural";
import { groupItems, rangeLabel } from "@/lib/views";
import { ProjectDot } from "./icons";
import type { Item, Project } from "@/lib/types";

const C = {
  surface: "var(--color-surface)",
  bg: "var(--color-bg)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
  hairline: "rgba(16,16,16,.06)",
} as const;

const PRIORITY_PASTEL: Record<1 | 2 | 3 | 4, { bg: string; fg: string }> = {
  1: { bg: "var(--color-late-100)", fg: "var(--color-late-700)" },
  2: { bg: "var(--color-idea-100)", fg: "var(--color-idea-700)" },
  3: { bg: "var(--color-task-100)", fg: "var(--color-task-700)" },
  4: { bg: "var(--color-bg)", fg: "var(--color-ink-muted)" },
};

type Filter = "all" | "today" | "late" | "project";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "today", label: "Aujourd'hui" },
  { key: "late", label: "En retard" },
  { key: "project", label: "Par projet" },
];

export function MyTasksScreen({
  items,
  projects,
  loading,
  onToggleDone,
  onOpenTask,
  onCapture,
  projectFilter,
  onClearProjectFilter,
}: {
  /** Les items ACTIFS — les idées vivent dans leur écran, pas ici. */
  items: Item[];
  projects: Project[];
  loading: boolean;
  onToggleDone: (id: string) => void;
  onOpenTask: (id: string) => void;
  onCapture: () => void;
  /** Le projet sur lequel la liste est restreinte, venu de l'écran Projets. */
  projectFilter: Project | null;
  onClearProjectFilter: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const now = useMemo(() => new Date(), []);
  const byId = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const open = useMemo(() => items.filter((it) => !it.doneAt), [items]);

  const groups = useMemo(() => {
    if (filter === "project") {
      // Groupé par projet : l'ordre suit celui des projets, pas celui des
      // items — sinon deux rendus successifs peuvent réordonner les sections.
      return projects
        .filter((p) => !p.archived)
        .map((p) => ({ key: p.id, label: p.name, items: open.filter((it) => it.projectId === p.id) }))
        .filter((g) => g.items.length > 0);
    }
    const all = groupItems(open, "time", [], now);
    if (filter === "today") return all.filter((g) => g.key === "today");
    if (filter === "late") return all.filter((g) => g.key === "overdue");
    return all;
  }, [filter, open, projects, now]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="min-h-0 flex-1 overflow-auto px-5 pb-2" style={{ animation: "fade .25s both" }}>
      <h2 className="mb-1 pt-1 text-[30px] font-extrabold tracking-[-0.035em]">Mes tâches</h2>
      <p className="mb-4 text-[13.5px] font-medium leading-[1.45]" style={{ color: C.inkMuted }}>
        {plural(open.length, "ouverte")}
        {projectFilter ? ` dans ${projectFilter.name}.` : ", toutes destinations confondues."}
      </p>

      {/* Un filtre venu d'un autre écran DOIT se voir et s'annuler : sans ça,
          une liste restreinte est indiscernable d'une liste vide. */}
      {projectFilter && (
        <button
          type="button"
          onClick={onClearProjectFilter}
          className="mb-4 flex items-center gap-2 font-bold"
          style={{
            height: 32,
            padding: "0 12px",
            borderRadius: 999,
            border: "none",
            background: C.ink,
            color: "#FFFFFF",
            fontFamily: "inherit",
            fontSize: 12.5,
          }}
        >
          <span className="flex-none" style={{ color: skinFor(projectFilter).bg }}>
            <ProjectDot size={8} shape={shapeFor(projectFilter)} />
          </span>
          <span>{projectFilter.name}</span>
          <span aria-hidden="true" style={{ opacity: 0.7 }}>✕</span>
          <span className="sr-only">Retirer le filtre de projet</span>
        </button>
      )}

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-0.5">
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={on}
              className="flex-none font-bold"
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 999,
                border: "none",
                fontFamily: "inherit",
                fontSize: 12.5,
                background: on ? C.ink : C.surface,
                color: on ? "#FFFFFF" : C.inkMuted,
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={<TaskCheckIcon size={20} className="text-ink-faint" />}
          title={filter === "all" ? "Rien à faire" : "Rien dans ce filtre"}
          description={
            filter === "all"
              ? "Dicte une note : Brief la découpe en tâches et en rendez-vous."
              : "Change de filtre, ou dicte quelque chose de neuf."
          }
          actionLabel={filter === "all" ? "Dicter" : undefined}
          onAction={filter === "all" ? onCapture : undefined}
        />
      ) : (
        <div className="flex flex-col gap-5 pb-4">
          {groups.map((g) => (
            <section key={g.key}>
              <div className="mb-2.5 ml-1 flex items-center gap-2.5">
                <span className="text-[14px] font-extrabold tracking-[-0.01em]">{g.label}</span>
                <span className="tnum font-mono" style={{ fontSize: 11, color: C.inkFaint }}>
                  {g.items.length}
                </span>
              </div>

              <div
                style={{
                  background: C.surface,
                  borderRadius: 24,
                  padding: "4px 16px",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                {g.items.map((it, i) => {
                  const project = projectById.get(it.projectId);
                  const status = statusOf(it, now, byId);
                  const pastel = PRIORITY_PASTEL[it.priority];
                  return (
                    <div
                      key={it.id}
                      className="flex items-center gap-3"
                      style={{
                        padding: "13px 0",
                        // Pas de filet sous la DERNIÈRE ligne : il flotterait
                        // au-dessus du bord arrondi de la carte.
                        borderBottom: i === g.items.length - 1 ? "none" : `1px solid ${C.hairline}`,
                      }}
                    >
                      <button
                        type="button"
                        aria-label={`Marquer « ${it.title} » comme faite`}
                        onClick={() => onToggleDone(it.id)}
                        className="flex flex-none items-center justify-center"
                        style={{
                          width: 22,
                          height: 22,
                          padding: 0,
                          borderRadius: 99,
                          border: "1.6px solid rgba(16,16,16,.22)",
                          background: "transparent",
                          color: "transparent",
                        }}
                      >
                        <CheckIcon size={12} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenTask(it.id)}
                        className="min-w-0 flex-1 text-left"
                        style={{ border: "none", background: "none", padding: 0, fontFamily: "inherit" }}
                      >
                        <span className="block truncate text-[14px] font-semibold">{it.title}</span>
                        <span
                          className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold"
                          style={{ color: status === "late" ? "var(--color-late-700)" : C.inkMuted }}
                        >
                          {project && (
                            <span className="flex-none" style={{ color: skinFor(project).bg }}>
                              <ProjectDot size={7} shape={shapeFor(project)} />
                            </span>
                          )}
                          <span className="truncate">
                            {rangeLabel(it, now)}
                            {project ? ` · ${project.name}` : ""}
                          </span>
                        </span>
                      </button>

                      <span
                        className="flex-none font-bold"
                        style={{
                          padding: "3px 9px",
                          borderRadius: 999,
                          fontSize: 10,
                          background: pastel.bg,
                          color: pastel.fg,
                        }}
                      >
                        {PRIORITY_LABEL[it.priority]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
