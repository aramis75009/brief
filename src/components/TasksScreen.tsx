"use client";

import { useState } from "react";
import { DoneBox } from "./DoneBox";
import { ProjectDot } from "./icons";
import { formatDue } from "@/lib/due";
import { PRIORITIES, shapeFor, skinFor } from "@/lib/projects";
import { sortItems, type TaskSort } from "@/lib/tasks";
import type { Project, Item } from "@/lib/types";

const FILTERS = [
  { key: "all", label: "Tout" },
  { key: "task", label: "Tâches" },
  { key: "event", label: "Rendez-vous" },
] as const;

const SORT_OPTIONS: { key: TaskSort; label: string }[] = [
  { key: "project", label: "Projets" },
  { key: "urgency", label: "Urgence" },
  { key: "due", label: "Échéance" },
  { key: "priority", label: "Priorité" },
];

export type FilterKey = (typeof FILTERS)[number]["key"];

export function TasksScreen({
  sent,
  pending,
  projects,
  filter,
  onFilter,
  onOpen,
  onToggleDone,
  busyId,
}: {
  sent: Item[];
  /** Dictées encore en file locale — visibles, mais jamais dites enregistrées. */
  pending: Item[];
  projects: Project[];
  filter: FilterKey;
  onFilter: (f: FilterKey) => void;
  onOpen: (id: string) => void;
  onToggleDone: (id: string, done: boolean) => void;
  /** Item dont la coche attend le serveur — empêche le double appui. */
  busyId: string | null;
}) {
  const [sort, setSort] = useState<TaskSort>("project");
  const [showDone, setShowDone] = useState(false);

  // Les items en attente passent devant : ce sont les seuls qui peuvent encore
  // être perdus, donc les seuls qui demandent une action.
  const all = [...pending, ...sent];

  // Filtrage par type et par statut terminé
  const filtered = all.filter((t) => {
    if (filter !== "all" && t.kind !== filter) return false;
    if (!showDone && t.doneAt) return false;
    return true;
  });

  const sortedItems = sortItems(filtered, sort);

  // Map rapide de projet pour le rendu en vue liste à plat
  const projectsMap = new Map(projects.map((p) => [p.id, p]));

  const groups = projects
    .map((p) => {
      const items = sortedItems.filter((t) => t.projectId === p.id);
      return items.length ? { project: p, items } : null;
    })
    .filter((g): g is { project: Project; items: Item[] } => g !== null);

  // Tâches dont le projet n'est plus dans la liste — jamais masquées.
  const known = new Set(projects.map((p) => p.id));
  const orphans = sortedItems.filter((t) => !known.has(t.projectId));

  const totalDoneCount = all.filter((t) => !!t.doneAt).length;

  const renderItemCard = (t: Item, showProjectBadge = false) => {
    const done = !!t.doneAt;
    const isEvent = t.kind === "event";
    const waiting = !!t.pendingAt;
    const proj: Project = projectsMap.get(t.projectId) || { id: t.projectId, name: "Autre", tint: 7 as const, shape: "disc" as const };
    const skin = skinFor(proj);

    return (
      <div
        key={t.id}
        className={
          "flex w-full items-start gap-3 rounded-row px-[15px] py-[13px] transition-all duration-200 " +
          (waiting ? "" : "border bg-tile shadow-[var(--e1)] hover:-translate-y-px")
        }
        style={
          waiting
            ? { border: "1.5px dashed var(--color-ink-3)", background: "transparent" }
            : { borderColor: "var(--line)" }
        }
      >
        {!waiting && (
          <span className="mt-[1px] ml-[9px] flex-none">
            <DoneBox
              done={done}
              busy={busyId === t.id}
              label={done ? `Rouvrir « ${t.title} »` : `Marquer « ${t.title} » comme fait`}
              onToggle={() => onToggleDone(t.id, !done)}
            />
          </span>
        )}
        <button
          type="button"
          onClick={() => !waiting && onOpen(t.id)}
          disabled={waiting}
          className={
            "min-w-0 flex-1 border-none bg-transparent p-0 text-left " +
            (waiting ? "cursor-default" : "cursor-pointer")
          }
        >
          <div className="flex items-start gap-2.5">
            <span
              className={
                "flex-1 text-15 leading-[1.4] font-medium text-pretty " +
                (done ? "text-ink-3 line-through" : "text-ink")
              }
            >
              {t.title}
            </span>
            <span
              className="mt-px flex-none text-11 font-semibold"
              style={{
                color: waiting
                  ? "var(--color-ink-2)"
                  : done
                    ? "var(--color-ok)"
                    : "var(--color-ink-3)",
              }}
            >
              {waiting ? "en attente" : done ? "✓ fait" : isEvent ? "rendez-vous" : "tâche"}
            </span>
          </div>
          <div className="mt-[7px] flex flex-wrap items-center gap-2">
            {showProjectBadge && (
              <>
                <span
                  className="inline-flex h-5 items-center gap-1 rounded-chip px-1.5 text-11 font-semibold"
                  style={{ background: skin.bg, color: skin.fg }}
                >
                  <ProjectDot shape={shapeFor(proj)} />
                  {proj.name}
                </span>
                <span className="h-[3px] w-[3px] rounded-full bg-ink-3" />
              </>
            )}
            <span className="text-11 font-medium text-ink-2">
              {formatDue(t.due, t.allDay)}
            </span>
            <span className="h-[3px] w-[3px] rounded-full bg-ink-3" />
            <span
              className="text-11 font-semibold"
              style={{
                color:
                  PRIORITIES[t.priority].fg === "var(--color-ink)"
                    ? "var(--color-ink-3)"
                    : PRIORITIES[t.priority].fg,
              }}
            >
              {PRIORITIES[t.priority].label}
            </span>
          </div>
          {t.rrule && (
            <p className="mt-2 mb-0 text-11 leading-[1.4] text-ink-3">
              se répète
            </p>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none px-[26px] pt-2.5 pb-3">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="my-0 text-27 font-semibold tracking-[-0.5px] text-ink">Tâches</h1>
          {totalDoneCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDone(!showDone)}
              className="cursor-pointer border-none bg-transparent p-1 text-13 font-medium transition-colors"
              style={{ color: showDone ? "var(--color-action)" : "var(--color-ink-3)" }}
            >
              {showDone ? "Masquer faites" : `Faites (${totalDoneCount})`}
            </button>
          )}
        </div>

        {pending.length > 0 && (
          <div
            className="mb-3 rounded-row px-3.5 py-2.5"
            style={{ border: "1.5px dashed var(--color-ink-3)" }}
            role="status"
          >
            <p className="m-0 text-13 leading-[1.45] font-semibold text-ink">
              {pending.length} note{pending.length > 1 ? "s" : ""} en attente d&apos;envoi
            </p>
            <p className="mt-1 mb-0 text-11 leading-[1.45] font-normal text-ink-2">
              Pas encore enregistrée{pending.length > 1 ? "s" : ""} sur le serveur. Ça repart à la
              prochaine ouverture avec du réseau.
            </p>
          </div>
        )}

        {/* Filtres de types */}
        <div className="flex gap-1 rounded-field bg-page p-1">
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onFilter(f.key)}
                aria-pressed={on}
                className="h-9 flex-1 cursor-pointer rounded-chip border-none text-13 font-semibold transition-all duration-200"
                style={{
                  background: on ? "var(--color-tile)" : "transparent",
                  color: on ? "var(--color-ink)" : "var(--color-ink-3)",
                  boxShadow: on ? "var(--e1)" : "none",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Options de tri */}
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto py-0.5 text-11 font-medium text-ink-3">
          <span className="flex-none pr-1">Tri :</span>
          {SORT_OPTIONS.map((opt) => {
            const active = sort === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSort(opt.key)}
                aria-pressed={active}
                className="h-7 flex-none cursor-pointer rounded-chip border-none px-2.5 text-11 font-semibold transition-all duration-150"
                style={{
                  background: active ? "var(--color-ink)" : "var(--color-page)",
                  color: active ? "var(--color-tile)" : "var(--color-ink-2)",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-1 pb-[18px]">
        {sort === "project" ? (
          <>
            {[...groups, ...(orphans.length ? [{ project: { id: "?", name: "Autre", tint: 7 as const, shape: "disc" as const }, items: orphans }] : [])].map(
              ({ project, items }) => {
                const skin = skinFor(project);
                return (
                  <div key={project.id} className="mb-5">
                    <div className="mx-1 mt-0 mb-[9px] flex items-center gap-2">
                      <span
                        className="inline-flex h-6 items-center gap-2 rounded-chip px-[9px] text-11 font-semibold"
                        style={{ background: skin.bg, color: skin.fg }}
                      >
                        <ProjectDot shape={shapeFor(project)} />
                        {project.name}
                      </span>
                      <span className="text-11 font-medium text-ink-3">
                        {items.length} {items.length > 1 ? "items" : "item"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {items.map((t) => renderItemCard(t, false))}
                    </div>
                  </div>
                );
              },
            )}
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedItems.map((t) => renderItemCard(t, true))}
          </div>
        )}

        {!sortedItems.length && (
          <div className="px-5 py-16 text-center">
            <p className="m-0 text-13 leading-[1.5] font-medium text-ink-3">
              {all.length ? "Aucun item pour ce filtre ou tri." : "Aucun item enregistré pour l'instant."}
              <br />
              {!all.length && "Dicte une note pour commencer."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
